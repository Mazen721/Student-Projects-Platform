import mongoose from 'mongoose';
import {
  ADOPTION_REQUEST_STATUSES,
  PROPOSAL_STATUSES,
  TEAM_INVITATION_STATUSES,
  TRANSFER_STATUSES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { getCycleWindowDates, isProposalResubmitOpen, isRegistrationOpen, computeTrending } from '@spp/shared/calc';
import { t } from '@spp/shared/locales/ar';
import { proposalMachine } from '@spp/shared/machines';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findSimilarProjectTitles, searchProjects } from '../../core/search/searchProvider.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import { findUserBasicById, findUsersBasicByIds } from '../auth/index.js';
import { getAcademicYearInfo, getCollegeAndCurrentYear } from '../organization/index.js';
import AdoptionRequest from './adoptionRequest.model.js';
import LeadershipTransfer from './leadershipTransfer.model.js';
import Project from './project.model.js';
import ProjectMembership from './projectMembership.model.js';
import ProposalVersion from './proposalVersion.model.js';
import TeamInvitation from './teamInvitation.model.js';
import {
  createDraftProjectRecord,
  getActorRoleName,
  hydrateProjects,
  saveNextProposalVersion,
} from './projectShared.js';

const approvalHooks = [];

export function registerOnProjectApprovedHook(hookFn) {
  if (typeof hookFn === 'function' && !approvalHooks.includes(hookFn)) {
    approvalHooks.push(hookFn);
  }
}

export async function listProjects(scopeFilter = {}, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, [
    '-createdAt',
    'createdAt',
    'title',
    '-progress.percent',
  ]);

  const filters = {};
  if (query.academicYearId) filters.academicYearId = query.academicYearId;
  if (query.collegeId) filters.collegeId = query.collegeId;
  if (query.departmentId) filters.departmentId = query.departmentId;
  if (query.status) filters.status = query.status;
  if (query.supervisorId) filters.supervisorIds = query.supervisorId;
  if (query.field) filters.field = query.field;
  if (query.type) filters.type = query.type;

  const { items, total } = await searchProjects(Project, {
    q: query.q || '',
    scopeFilter,
    filters,
    skip,
    limit,
    sort,
  });

  const hydrated = await hydrateProjects(items);
  return {
    items: hydrated,
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function getSimilarTitles({ title, excludeId }) {
  return findSimilarProjectTitles(Project, { title, excludeId });
}

export async function createProposal(payload, { actor }) {
  const user = await findUserBasicById(actor.id);
  if (!user || !user.collegeId || !user.departmentId) {
    throw AppError.forbidden();
  }

  const { college, currentYear } = await getCollegeAndCurrentYear(user.collegeId);
  if (!college || !currentYear) {
    throw new AppError('WINDOW_CLOSED', { details: getCycleWindowDates(currentYear?.cycle) });
  }
  if (!isRegistrationOpen(currentYear.cycle)) {
    throw new AppError('WINDOW_CLOSED', { details: getCycleWindowDates(currentYear.cycle) });
  }

  const verifiedCover = payload.cover
    ? await verifyUpload(payload.cover, { userId: actor.id, expectedPurpose: 'project_cover' })
    : null;

  const session = await mongoose.startSession();
  try {
    let createdProject;
    await session.withTransaction(async () => {
      createdProject = await createDraftProjectRecord({
        payload: { ...payload, cover: verifiedCover },
        leader: user,
        academicYear: currentYear,
        eventName: 'CREATE',
        session,
      });
    });

    const [hydrated] = await hydrateProjects([createdProject]);
    return hydrated;
  } finally {
    await session.endSession();
  }
}

export async function getProjectById(projectId) {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw AppError.notFound();
  }
  const [hydrated] = await hydrateProjects([project]);
  return hydrated;
}

export async function getProjectSummary(projectId) {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw AppError.notFound();
  }
  const [hydrated] = await hydrateProjects([project]);
  const leader = hydrated.teamMembers.find(
    (m) => m.userId === String(project.team.leaderId)
  );
  const partnerMembers = hydrated.teamMembers.filter(
    (m) => m.collegeId && m.collegeId !== String(project.collegeId)
  );

  return {
    id: hydrated.id,
    title: hydrated.title,
    status: hydrated.status,
    college: hydrated.college,
    department: hydrated.department,
    academicYearLabel: hydrated.academicYearLabel,
    leaderName: leader?.name || '',
    partnerMembers: partnerMembers.map((m) => ({
      userId: m.userId,
      name: m.name,
      collegeId: m.collegeId,
      departmentId: m.departmentId,
    })),
    supervisorName: hydrated.supervisor?.name || null,
    progress: { percent: hydrated.progress?.percent || 0 },
    statusFlag: hydrated.statusFlag,
  };
}

export async function updateProposal(projectId, payload, { actor }) {
  const project = await Project.findById(projectId);
  if (!project) {
    throw AppError.notFound();
  }
  if (
    ![PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.NEEDS_CHANGES].includes(project.status)
  ) {
    throw new AppError('INVALID_TRANSITION');
  }

  const leader = await findUserBasicById(project.team.leaderId);
  if (!leader || leader.status === USER_STATUSES.DEACTIVATED) {
    throw AppError.forbidden();
  }

  if (payload.cover) {
    project.cover = await verifyUpload(payload.cover, {
      userId: actor.id,
      expectedPurpose: 'project_cover',
    });
  }

  const editableFields = [
    'title',
    'idea',
    'problem',
    'objectives',
    'scope',
    'field',
    'type',
    'beneficiaries',
    'keywords',
    'expectedOutcomes',
    'preferredSupervisorId',
  ];
  for (const field of editableFields) {
    if (payload[field] !== undefined) {
      project[field] = payload[field];
    }
  }

  await project.save();
  const [hydrated] = await hydrateProjects([project]);
  return hydrated;
}

function buildTransitionContext({ project, actor, leader, college, ay, comment }) {
  const actorRoles = (actor.roles || []).map((r) => r.role);
  if (String(project.team.leaderId) === String(actor.id)) {
    actorRoles.push('leader');
  }
  return {
    roles: actorRoles,
    comment,
    windowOpen: isRegistrationOpen(ay?.cycle),
    resubmitOpen: isProposalResubmitOpen(ay?.cycle),
    teamCount: (project.activeMemberIds || []).length,
    teamSizeMin: college?.settings?.teamSizeMin || 1,
    leaderDeactivated: !leader || leader.status === USER_STATUSES.DEACTIVATED,
  };
}

function mapMachineFailure(outcome, cycle) {
  if (outcome.code === 'WINDOW_CLOSED') {
    return new AppError('WINDOW_CLOSED', { details: getCycleWindowDates(cycle) });
  }
  if (outcome.code === 'TEAM_BELOW_MIN') {
    return AppError.businessRule('TEAM_BELOW_MIN');
  }
  if (outcome.code === 'FORBIDDEN') {
    return AppError.forbidden();
  }
  if (outcome.code === 'VALIDATION_ERROR') {
    return new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'comment', code: 'validation.required', message: t('validation.required') }],
    });
  }
  return new AppError('INVALID_TRANSITION');
}

async function cancelPendingProjectRequests(projectId, session) {
  const now = new Date();
  await Promise.all([
    TeamInvitation.updateMany(
      { projectId, status: TEAM_INVITATION_STATUSES.PENDING },
      { $set: { status: TEAM_INVITATION_STATUSES.CANCELLED, respondedAt: now } },
      { session }
    ),
    LeadershipTransfer.updateMany(
      { projectId, status: TRANSFER_STATUSES.PENDING },
      { $set: { status: TRANSFER_STATUSES.CANCELLED, respondedAt: now } },
      { session }
    ),
    AdoptionRequest.updateMany(
      { projectId, status: ADOPTION_REQUEST_STATUSES.PENDING },
      { $set: { status: ADOPTION_REQUEST_STATUSES.DECLINED, decidedAt: now } },
      { session }
    ),
  ]);
}

function buildTransitionNotifications(project, event, outcome, actorId) {
  const link = `/app/projects/${project._id}`;
  const memberRecipients = (project.activeMemberIds || []).filter(
    (id) => String(id) !== String(actorId)
  );
  const supervisorRecipients = (project.supervisorIds || []).filter(
    (id) => String(id) !== String(actorId)
  );

  const recipients = ['SUBMIT', 'RESUBMIT', 'WITHDRAW'].includes(event)
    ? supervisorRecipients
    : memberRecipients;

  return recipients.map((userId) => ({
    userId,
    type: 'proposal_transition',
    titleKey: `statuses.${outcome.to}`,
    bodyKey: 'timeline.proposalSubmitted',
    vars: { title: project.title, status: outcome.to },
    link,
  }));
}

export async function transitionProposal(projectId, { event, comment }, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let updatedProject;
    let notifications = [];

    await session.withTransaction(async () => {
      const project = await Project.findById(projectId).session(session);
      if (!project) {
        throw AppError.notFound();
      }
      if (project.status === PROPOSAL_STATUSES.ARCHIVED) {
        throw AppError.businessRule('PROJECT_ARCHIVED');
      }

      const [{ college }, ay, leader] = await Promise.all([
        getCollegeAndCurrentYear(project.collegeId),
        getAcademicYearInfo(project.academicYearId),
        findUserBasicById(project.team.leaderId, session),
      ]);

      const ctx = buildTransitionContext({ project, actor, leader, college, ay, comment });
      const outcome = proposalMachine.evaluate(project.status, event, ctx);
      if (!outcome.allowed) {
        throw mapMachineFailure(outcome, ay?.cycle);
      }

      const beforeStatus = project.status;
      project.status = outcome.to;
      project.history.push({
        from: outcome.from,
        to: outcome.to,
        event,
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        comment: comment?.trim() || undefined,
        at: new Date(),
      });

      if (event === 'START_REVIEW' && !project.supervision.reviewerId) {
        project.supervision.reviewerId = actor.id;
      }

      if (event === 'SUBMIT' || event === 'RESUBMIT') {
        await saveNextProposalVersion(project, actor.id, session);
      }

      if (event === 'APPROVE') {
        await cancelPendingProjectRequests(project._id, session);
        for (const hook of approvalHooks) {
          await hook(project, { actor, session });
        }
      }

      if (event === 'REJECT' || event === 'WITHDRAW') {
        await cancelPendingProjectRequests(project._id, session);
        await ProjectMembership.updateMany(
          { projectId: project._id, active: true },
          { $set: { active: false } },
          { session }
        );
      }

      await project.save({ session });

      if (['APPROVE', 'REJECT', 'RETURN'].includes(event)) {
        await recordAudit({
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
          action: `proposal.${event.toLowerCase()}`,
          targetType: 'project',
          targetId: project._id,
          scope: {
            collegeId: project.collegeId,
            departmentId: project.departmentId,
            projectId: project._id,
          },
          before: { status: beforeStatus },
          after: { status: project.status },
          reason: comment,
          ip,
          session,
        });
      }

      notifications = buildTransitionNotifications(project, event, outcome, actor.id);
      updatedProject = project;
    });

    if (notifications.length > 0) {
      await sendBulkNotifications(notifications);
    }

    const [hydrated] = await hydrateProjects([updatedProject]);
    return hydrated;
  } finally {
    await session.endSession();
  }
}

export async function getProjectHistory(projectId) {
  const project = await Project.findById(projectId).select('history').lean();
  if (!project) {
    throw AppError.notFound();
  }
  const versions = await ProposalVersion.find({ projectId })
    .sort({ version: -1 })
    .select('version authorId createdAt')
    .lean();

  const actorIds = [
    ...(project.history || []).map((h) => h.actorId),
    ...versions.map((v) => v.authorId),
  ];
  const userMap = await findUsersBasicByIds(actorIds);

  return {
    history: (project.history || []).map((h) => ({
      ...h,
      actorName: userMap.get(String(h.actorId))?.name || '',
    })),
    versions: versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      authorId: String(v.authorId),
      authorName: userMap.get(String(v.authorId))?.name || '',
    })),
  };
}

export async function getProposalVersion(projectId, versionNumber) {
  const doc = await ProposalVersion.findOne({ projectId, version: Number(versionNumber) }).lean();
  if (!doc) {
    throw AppError.notFound();
  }
  return doc;
}

export async function archiveProjectsForAcademicYear(academicYearId, session = null) {
  const res = await Project.updateMany(
    { academicYearId, status: PROPOSAL_STATUSES.APPROVED },
    { $set: { status: PROPOSAL_STATUSES.ARCHIVED } },
    session ? { session } : undefined
  );
  return res.modifiedCount || 0;
}

export async function getProjectForTracking(projectId, { requireWritable = false, session = null } = {}) {
  const query = Project.findById(projectId).select(
    '_id title status defenseState collegeId departmentId academicYearId academicYearLabel activeMemberIds supervision supervisorIds progress budgetEstimate statusFlag'
  );
  if (session) query.session(session);
  const project = await query.lean();
  if (!project) {
    throw AppError.notFound();
  }
  if (requireWritable && project.status === PROPOSAL_STATUSES.ARCHIVED) {
    throw AppError.businessRule('PROJECT_ARCHIVED');
  }
  return project;
}

export async function updateProjectProgress(
  projectId,
  progress,
  { regressDefenseIfEligible = false, session = null } = {}
) {
  const update = {
    $set: {
      progress: {
        percent: progress.percent,
        perPhase: progress.perPhase,
        computedAt: new Date(),
      },
    },
  };
  if (regressDefenseIfEligible) {
    update.$set.defenseState = 'not_eligible';
    update.$unset = { supervisorSignOff: 1 };
  }
  const filter = regressDefenseIfEligible
    ? { _id: projectId, defenseState: 'eligible' }
    : { _id: projectId };
  const opts = session ? { session, new: true } : { new: true };
  let updated = await Project.findOneAndUpdate(filter, update, opts).select('progress defenseState').lean();
  if (!updated && regressDefenseIfEligible) {
    delete update.$set.defenseState;
    delete update.$unset;
    updated = await Project.findOneAndUpdate({ _id: projectId }, update, opts)
      .select('progress defenseState')
      .lean();
  }
  return updated;
}

export async function getProjectForEvaluation(projectId, { session = null } = {}) {
  const query = Project.findById(projectId).select(
    '_id title slug status defenseState supervisorSignOff collegeId departmentId academicYearId academicYearLabel activeMemberIds team.members supervision supervisorIds'
  );
  if (session) query.session(session);
  const project = await query.lean();
  if (!project) {
    throw AppError.notFound();
  }
  return project;
}

export async function updateProjectDefenseState(
  projectId,
  { defenseState, supervisorSignOff },
  { session = null } = {}
) {
  const $set = {};
  if (defenseState !== undefined) $set.defenseState = defenseState;
  if (supervisorSignOff !== undefined) $set.supervisorSignOff = supervisorSignOff;
  const opts = session ? { session, new: true } : { new: true };
  return Project.findByIdAndUpdate(projectId, { $set }, opts)
    .select('_id defenseState supervisorSignOff')
    .lean();
}

export async function updateProjectBudget(projectId, budgetEstimate, { session = null } = {}) {
  const opts = session ? { session, new: true } : { new: true };
  return Project.findByIdAndUpdate(projectId, { $set: { budgetEstimate } }, opts)
    .select('budgetEstimate')
    .lean();
}

export async function updateProjectStatusFlag(projectId, statusFlag) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  const updated = await Project.findByIdAndUpdate(
    project._id,
    { $set: { statusFlag } },
    { new: true }
  )
    .select('_id statusFlag')
    .lean();
  return { id: String(updated._id), statusFlag: updated.statusFlag };
}

export async function listApprovedProjectsForReminders() {
  return Project.find({ status: PROPOSAL_STATUSES.APPROVED })
    .select('_id title activeMemberIds')
    .lean();
}

const SHOWCASE_PROJECT_SELECT =
  '_id title slug idea problem scope field type beneficiaries keywords expectedOutcomes cover collegeId departmentId academicYearId academicYearLabel status team activeMemberIds supervision supervisorIds isPublished showcaseStats createdAt';

export async function getProjectForShowcase(projectId, { session = null } = {}) {
  const query = Project.findById(projectId).select(SHOWCASE_PROJECT_SELECT);
  if (session) query.session(session);
  const project = await query.lean();
  if (!project) {
    throw AppError.notFound();
  }
  return project;
}

export async function getPublishedProjectBySlug(slug) {
  return Project.findOne({ slug, isPublished: true }).select(SHOWCASE_PROJECT_SELECT).lean();
}

export async function listPublishedProjectsForShowcase({ q = '', filters = {}, skip = 0, limit = 20, sort = { 'showcaseStats.trendingScore': -1, createdAt: -1 } } = {}) {
  const effectiveFilters = { ...filters, isPublished: true };
  return searchProjects(Project, {
    q,
    scopeFilter: {},
    filters: effectiveFilters,
    skip,
    limit,
    sort,
  });
}

export async function listPublishedProjectsByIds(projectIds = []) {
  const ids = [...new Set(projectIds.filter(Boolean).map(String))];
  if (ids.length === 0) return [];
  return Project.find({ _id: mongoose.trusted({ $in: ids }), isPublished: true })
    .select(SHOWCASE_PROJECT_SELECT)
    .lean();
}

export async function updateProjectShowcasePublishState(projectId, isPublished, { session = null } = {}) {
  const opts = session ? { session, new: true } : { new: true };
  return Project.findByIdAndUpdate(projectId, { $set: { isPublished: Boolean(isPublished) } }, opts)
    .select('_id isPublished')
    .lean();
}

export async function incrementProjectShowcaseStats(projectId, incFields = {}, { session = null } = {}) {
  const $inc = {};
  for (const [key, val] of Object.entries(incFields)) {
    if (typeof val === 'number' && val !== 0) {
      $inc[`showcaseStats.${key}`] = val;
    }
  }
  if (Object.keys($inc).length === 0) return null;
  const opts = session ? { session, new: true } : { new: true };
  return Project.findByIdAndUpdate(projectId, { $inc }, opts)
    .select('_id showcaseStats')
    .lean();
}

export async function listPublishedProjectIdsForTrending() {
  return Project.find({ isPublished: true })
    .select('_id showcaseStats.votes7d showcaseStats.views7d')
    .lean();
}

export async function bulkUpdateProjectTrendingStats(updates = []) {
  if (updates.length === 0) return 0;
  const ops = updates.map((entry) => ({
    updateOne: {
      filter: { _id: entry.projectId },
      update: {
        $set: {
          'showcaseStats.votes7d': entry.votes7d,
          'showcaseStats.views7d': entry.views7d,
          'showcaseStats.trendingScore': computeTrending({
            votes7d: entry.votes7d,
            views7d: entry.views7d,
          }),
        },
      },
    },
  }));
  const res = await Project.bulkWrite(ops, { ordered: false });
  return res.modifiedCount || 0;
}
