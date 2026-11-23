import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  COMPETITION_STATES,
  ROLES,
  VOTE_STATUSES,
} from '@spp/shared/constants';
import { voteEligibility } from '@spp/shared/calc';
import { env } from '../../config/env.js';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUserBasicById, findUsersBasicByIds } from '../auth/index.js';
import {
  getUniversityShowcaseConfig,
  resolveScopeHierarchy,
} from '../organization/index.js';
import {
  getProjectForShowcase,
  incrementProjectShowcaseStats,
  listPublishedProjectsByIds,
} from '../projects/index.js';
import Competition from './competition.model.js';
import CompetitionVote from './competitionVote.model.js';
import Vote from './vote.model.js';
import VoteIpCounter from './voteIpCounter.model.js';

const COUNTABLE_VOTE_STATUSES = [VOTE_STATUSES.VALID, VOTE_STATUSES.CLEARED];
const BURST_WINDOW_MS = 10 * 60 * 1000;

function hashIp(ip) {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(String(ip || 'unknown'))
    .digest('hex');
}

function throwEligibilityError(result) {
  if (result.code === 'ACCOUNT_INACTIVE') {
    throw AppError.forbidden();
  }
  const vars = result.availableAt ? { availableAt: result.availableAt.toISOString() } : {};
  throw AppError.businessRule(result.code, vars);
}

async function checkIpBurstAndGetStatus(ipHash, burstThreshold) {
  const bucketMs = Math.floor(Date.now() / BURST_WINDOW_MS) * BURST_WINDOW_MS;
  const window = new Date(bucketMs);
  const counter = await VoteIpCounter.findOneAndUpdate(
    { ipHash, window },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true }
  );
  return counter.count > burstThreshold ? VOTE_STATUSES.FLAGGED : VOTE_STATUSES.VALID;
}

export async function castVote(projectId, { actor, ip }) {
  const [project, user, uniConfig] = await Promise.all([
    getProjectForShowcase(projectId),
    findUserBasicById(actor.id),
    getUniversityShowcaseConfig(),
  ]);
  if (!project.isPublished) throw AppError.notFound();

  const eligibility = voteEligibility({
    user,
    project,
    minAccountAgeHours: uniConfig.minVoteAccountAgeHours,
  });
  if (!eligibility.eligible) throwEligibilityError(eligibility);

  const alreadyVoted = await Vote.exists({ projectId: project._id, userId: actor.id });
  if (alreadyVoted) {
    throw new AppError('ALREADY_VOTED');
  }

  const ipHash = hashIp(ip);
  const voteStatus = await checkIpBurstAndGetStatus(ipHash, uniConfig.voteBurstPerIp10m);

  let voteCount = project.showcaseStats?.validVotes || 0;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      try {
        await Vote.create(
          [
            {
              projectId: project._id,
              userId: actor.id,
              status: voteStatus,
              ipHash,
              collegeId: project.collegeId,
              departmentId: project.departmentId,
            },
          ],
          { session }
        );
      } catch (err) {
        if (err?.code === 11000) throw new AppError('ALREADY_VOTED');
        throw err;
      }

      if (voteStatus === VOTE_STATUSES.VALID) {
        const updated = await incrementProjectShowcaseStats(
          project._id,
          { validVotes: 1, votes7d: 1 },
          { session }
        );
        voteCount = updated?.showcaseStats?.validVotes ?? voteCount + 1;
      }
    });
  } finally {
    await session.endSession();
  }

  return { status: voteStatus, voteCount };
}

export async function withdrawVote(projectId, { actor }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const removed = await Vote.findOneAndDelete({ projectId, userId: actor.id }).session(session);
      if (!removed) throw AppError.notFound();

      if (COUNTABLE_VOTE_STATUSES.includes(removed.status)) {
        await incrementProjectShowcaseStats(
          projectId,
          { validVotes: -1, votes7d: -1 },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function listFlaggedVotes(scopeFilter = {}, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt', 'createdAt']);
  const filter = { ...scopeFilter, status: VOTE_STATUSES.FLAGGED };

  const [votes, total] = await Promise.all([
    Vote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Vote.countDocuments(filter),
  ]);

  const [usersMap, projects] = await Promise.all([
    findUsersBasicByIds(votes.map((v) => v.userId)),
    listPublishedProjectsByIds(votes.map((v) => v.projectId)),
  ]);
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));

  const items = votes.map((vote) => {
    const voter = usersMap.get(String(vote.userId));
    const proj = projectMap.get(String(vote.projectId));
    return {
      id: String(vote._id),
      projectId: String(vote.projectId),
      projectTitle: proj?.title || '',
      projectSlug: proj?.slug || '',
      userId: String(vote.userId),
      voterName: voter?.name || '',
      status: vote.status,
      createdAt: vote.createdAt,
    };
  });

  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function reviewFlaggedVote(voteId, { decision, reason }, { actor, ip }) {
  const nextStatus = decision === 'clear' ? VOTE_STATUSES.CLEARED : VOTE_STATUSES.REJECTED;
  let voteCount = 0;
  let resultStatus = nextStatus;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const vote = await Vote.findOne({ _id: voteId, status: VOTE_STATUSES.FLAGGED }).session(session);
      if (!vote) throw AppError.notFound();

      vote.status = nextStatus;
      vote.reviewedBy = actor.id;
      vote.reviewedAt = new Date();
      vote.reviewReason = reason?.trim() || undefined;
      await vote.save({ session });

      if (decision === 'clear') {
        const updated = await incrementProjectShowcaseStats(
          vote.projectId,
          { validVotes: 1, votes7d: 1 },
          { session }
        );
        voteCount = updated?.showcaseStats?.validVotes ?? 1;
      } else {
        const proj = await getProjectForShowcase(vote.projectId, { session });
        voteCount = proj.showcaseStats?.validVotes || 0;
      }

      await recordAudit({
        actorId: actor.id,
        actorRole: actor?.roles?.[0]?.role || '',
        action: `vote.${decision}`,
        targetType: 'vote',
        targetId: vote._id,
        scope: { collegeId: vote.collegeId, departmentId: vote.departmentId, projectId: vote.projectId },
        before: { status: VOTE_STATUSES.FLAGGED },
        after: { status: nextStatus },
        reason: reason?.trim(),
        ip,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  return { id: String(voteId), status: resultStatus, voteCount };
}

export async function invalidateImpostorVotes(userId, session = null) {
  const votes = await Vote.find({
    userId,
    status: mongoose.trusted({
      $in: [VOTE_STATUSES.VALID, VOTE_STATUSES.CLEARED, VOTE_STATUSES.FLAGGED],
    }),
  }).session(session || null);

  for (const vote of votes) {
    const wasCounted = COUNTABLE_VOTE_STATUSES.includes(vote.status);
    vote.status = VOTE_STATUSES.REJECTED;
    vote.reviewReason = 'FR-013a';
    vote.reviewedAt = new Date();
    await vote.save(session ? { session } : undefined);

    if (wasCounted) {
      await incrementProjectShowcaseStats(
        vote.projectId,
        { validVotes: -1, votes7d: -1 },
        { session }
      );
    }
  }

  await CompetitionVote.updateMany(
    { userId, status: mongoose.trusted({ $ne: VOTE_STATUSES.REJECTED }) },
    { $set: { status: VOTE_STATUSES.REJECTED } },
    session ? { session } : undefined
  );

  return votes.length;
}

function resolveCompetitionState(startsAt, endsAt, now = new Date()) {
  if (now >= endsAt) return COMPETITION_STATES.CLOSED;
  if (now >= startsAt) return COMPETITION_STATES.OPEN;
  return COMPETITION_STATES.SCHEDULED;
}

async function computeLiveCompetitionRanking(competition) {
  const counts = await CompetitionVote.aggregate([
    {
      $match: {
        competitionId: competition._id,
        status: { $in: COUNTABLE_VOTE_STATUSES },
      },
    },
    { $group: { _id: '$projectId', votes: { $sum: 1 } } },
    { $sort: { votes: -1, _id: 1 } },
  ]);

  const countMap = new Map(counts.map((row) => [String(row._id), row.votes]));
  const allProjectIds = [
    ...new Set([
      ...(competition.eligibleProjectIds || []).map(String),
      ...counts.map((row) => String(row._id)),
    ]),
  ];

  const sorted = allProjectIds
    .map((pid) => ({ projectId: pid, votes: countMap.get(pid) || 0 }))
    .sort((a, b) => b.votes - a.votes || a.projectId.localeCompare(b.projectId))
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return sorted;
}

async function freezeCompetitionIfEnded(competition) {
  const now = new Date();
  if (competition.state === COMPETITION_STATES.CLOSED || now < new Date(competition.endsAt)) {
    if (
      competition.state === COMPETITION_STATES.SCHEDULED &&
      now >= new Date(competition.startsAt) &&
      now < new Date(competition.endsAt)
    ) {
      competition.state = COMPETITION_STATES.OPEN;
      await competition.save();
    }
    return competition;
  }

  const ranking = await computeLiveCompetitionRanking(competition);
  competition.state = COMPETITION_STATES.CLOSED;
  competition.frozenRanking = ranking.map((entry) => ({
    projectId: entry.projectId,
    votes: entry.votes,
    rank: entry.rank,
  }));
  competition.frozenAt = now;
  await competition.save();
  return competition;
}

function serializeCompetition(comp, ranking = [], projectMap = new Map()) {
  const enrich = (entry) => {
    const pid = String(entry.projectId);
    const proj = projectMap.get(pid);
    return {
      projectId: pid,
      votes: entry.votes,
      rank: entry.rank,
      ...(proj ? { title: proj.title, slug: proj.slug } : {}),
    };
  };

  return {
    id: String(comp._id),
    title: comp.title,
    scopeType: comp.scopeType,
    scopeId: comp.scopeId ? String(comp.scopeId) : null,
    collegeId: comp.collegeId ? String(comp.collegeId) : null,
    eligibleProjectIds: (comp.eligibleProjectIds || []).map(String),
    voterRestriction: comp.voterRestriction,
    startsAt: comp.startsAt,
    endsAt: comp.endsAt,
    state: comp.state,
    ranking: ranking.map(enrich),
    frozenRanking: (comp.frozenRanking || []).map(enrich),
    frozenAt: comp.frozenAt || null,
  };
}

export async function createCompetition(payload, { actor, ip }) {
  const actorTopRole = actor?.roles?.[0];
  let scopeId = payload.scopeId;
  if (payload.scopeType === 'college' && !scopeId && actorTopRole?.collegeId) {
    scopeId = String(actorTopRole.collegeId);
  }
  if (
    payload.scopeType === 'college' &&
    actorTopRole?.role === ROLES.COLLEGE_ADMIN &&
    String(actorTopRole.collegeId || actorTopRole.scopeId) !== String(scopeId)
  ) {
    throw AppError.forbidden();
  }
  if (payload.scopeType === 'university' && actorTopRole?.role !== ROLES.UNIVERSITY_ADMIN) {
    throw AppError.forbidden();
  }

  const hierarchy = await resolveScopeHierarchy(payload.scopeType, scopeId);
  const state = resolveCompetitionState(payload.startsAt, payload.endsAt);

  const comp = await Competition.create({
    title: payload.title,
    scopeType: payload.scopeType,
    scopeId: hierarchy.scopeId,
    collegeId: hierarchy.collegeId,
    departmentId: hierarchy.departmentId,
    eligibleProjectIds: payload.eligibleProjectIds || [],
    voterRestriction: payload.voterRestriction,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    state,
    createdBy: actor.id,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: actorTopRole?.role || '',
    action: 'competition.create',
    targetType: 'competition',
    targetId: comp._id,
    scope: { collegeId: comp.collegeId },
    after: { title: comp.title, scopeType: comp.scopeType, startsAt: comp.startsAt, endsAt: comp.endsAt },
    ip,
  });

  return serializeCompetition(comp);
}

export async function castCompetitionVote(competitionId, projectId, { actor, ip }) {
  const competition = await Competition.findById(competitionId);
  if (!competition) throw AppError.notFound();
  await freezeCompetitionIfEnded(competition);

  const [project, user, uniConfig] = await Promise.all([
    getProjectForShowcase(projectId),
    findUserBasicById(actor.id),
    getUniversityShowcaseConfig(),
  ]);
  if (!project.isPublished) throw AppError.notFound();

  const eligibility = voteEligibility({
    user,
    project,
    competition,
    minAccountAgeHours: uniConfig.minVoteAccountAgeHours,
  });
  if (!eligibility.eligible) throwEligibilityError(eligibility);

  try {
    await CompetitionVote.create({
      competitionId: competition._id,
      projectId: project._id,
      userId: actor.id,
      status: VOTE_STATUSES.VALID,
      ipHash: hashIp(ip),
      collegeId: project.collegeId,
      departmentId: project.departmentId,
    });
  } catch (err) {
    if (err?.code === 11000) throw new AppError('ALREADY_VOTED');
    throw err;
  }

  return {
    status: VOTE_STATUSES.VALID,
    competitionId: String(competition._id),
    projectId: String(project._id),
  };
}

export async function withdrawCompetitionVote(competitionId, projectId, { actor }) {
  const competition = await Competition.findById(competitionId);
  if (!competition) throw AppError.notFound();
  await freezeCompetitionIfEnded(competition);

  if (competition.state === COMPETITION_STATES.CLOSED || new Date() >= new Date(competition.endsAt)) {
    throw AppError.businessRule('COMPETITION_CLOSED');
  }

  const deleted = await CompetitionVote.findOneAndDelete({
    competitionId,
    projectId,
    userId: actor.id,
  });
  if (!deleted) throw AppError.notFound();
}

export async function listPublicCompetitions() {
  const comps = await Competition.find().sort({ startsAt: -1 }).lean();
  const hydrated = [];
  for (const raw of comps) {
    const doc = await Competition.findById(raw._id);
    await freezeCompetitionIfEnded(doc);
    const ranking =
      doc.state === COMPETITION_STATES.CLOSED
        ? doc.frozenRanking
        : await computeLiveCompetitionRanking(doc);
    const projects = await listPublishedProjectsByIds(
      ranking.map((r) => r.projectId).concat(doc.eligibleProjectIds || [])
    );
    const projectMap = new Map(projects.map((p) => [String(p._id), p]));
    hydrated.push(serializeCompetition(doc, ranking, projectMap));
  }
  return hydrated;
}

export async function getPublicCompetitionById(competitionId) {
  const doc = await Competition.findById(competitionId);
  if (!doc) throw AppError.notFound();
  await freezeCompetitionIfEnded(doc);

  const ranking =
    doc.state === COMPETITION_STATES.CLOSED
      ? doc.frozenRanking
      : await computeLiveCompetitionRanking(doc);
  const projects = await listPublishedProjectsByIds(
    ranking.map((r) => r.projectId).concat(doc.eligibleProjectIds || [])
  );
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));
  return serializeCompetition(doc, ranking, projectMap);
}

export async function syncCompetitionStates() {
  const candidates = await Competition.find({
    state: mongoose.trusted({ $ne: COMPETITION_STATES.CLOSED }),
  }).limit(50);

  let frozenCount = 0;
  let openedCount = 0;
  for (const comp of candidates) {
    const prevState = comp.state;
    await freezeCompetitionIfEnded(comp);
    if (comp.state === COMPETITION_STATES.CLOSED && prevState !== COMPETITION_STATES.CLOSED) {
      frozenCount += 1;
    } else if (comp.state === COMPETITION_STATES.OPEN && prevState === COMPETITION_STATES.SCHEDULED) {
      openedCount += 1;
    }
  }

  return { checked: candidates.length, openedCount, frozenCount };
}
