import mongoose from 'mongoose';
import {
  ADOPTION_REQUEST_STATUSES,
  IDEA_STATUSES,
  ROLES,
} from '@spp/shared/constants';
import { getCycleWindowDates, isRegistrationOpen } from '@spp/shared/calc';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendNotification } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUserBasicById, findUsersBasicByIds } from '../auth/index.js';
import { getCollegeAndCurrentYear } from '../organization/index.js';
import AdoptionRequest from './adoptionRequest.model.js';
import Idea from './idea.model.js';
import {
  createDraftProjectRecord,
  getActorRoleName,
  hydrateProjects,
} from './projectShared.js';

export async function listIdeas(scopeFilter = {}, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['-createdAt', 'createdAt']);
  const filter = { ...scopeFilter };
  filter.status = query.status || IDEA_STATUSES.OPEN;
  if (query.field) filter.field = query.field;
  if (query.collegeId) filter.collegeId = query.collegeId;
  if (query.ownerKind) filter.ownerKind = query.ownerKind;

  const [ideas, total] = await Promise.all([
    Idea.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Idea.countDocuments(filter),
  ]);

  const ownerMap = await findUsersBasicByIds(ideas.map((i) => i.ownerId));
  const items = ideas.map((idea) => ({
    ...idea,
    _id: String(idea._id),
    id: String(idea._id),
    ownerName: ownerMap.get(String(idea.ownerId))?.name || '',
  }));

  return {
    items,
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function createIdea(payload, { actor }) {
  const isInvestor = (actor.roles || []).some((r) => r.role === ROLES.INVESTOR);
  const ownerKind = isInvestor ? 'investor' : 'supervisor';
  const user = await findUserBasicById(actor.id);

  const idea = await Idea.create({
    title: payload.title,
    description: payload.description,
    field: payload.field,
    type: payload.type,
    ownerId: actor.id,
    ownerKind,
    collegeId: payload.collegeId || (!isInvestor ? user?.collegeId : null) || null,
  });

  return {
    ...idea.toObject(),
    _id: String(idea._id),
    id: String(idea._id),
  };
}

export async function updateIdea(ideaId, payload) {
  const idea = await Idea.findById(ideaId);
  if (!idea) throw AppError.notFound();
  if (idea.status !== IDEA_STATUSES.OPEN) {
    throw new AppError('INVALID_TRANSITION');
  }

  for (const field of ['title', 'description', 'field', 'type', 'collegeId']) {
    if (payload[field] !== undefined) {
      idea[field] = payload[field];
    }
  }
  await idea.save();
  return { ...idea.toObject(), _id: String(idea._id), id: String(idea._id) };
}

export async function removeIdea(ideaId, { reason }, { actor, ip }) {
  const idea = await Idea.findById(ideaId);
  if (!idea) throw AppError.notFound();
  if (idea.status === IDEA_STATUSES.REMOVED) {
    throw new AppError('INVALID_TRANSITION');
  }

  idea.status = IDEA_STATUSES.REMOVED;
  idea.removedBy = actor.id;
  idea.removedReason = reason;
  idea.removedAt = new Date();
  await idea.save();

  await AdoptionRequest.updateMany(
    { ideaId: idea._id, status: ADOPTION_REQUEST_STATUSES.PENDING },
    { $set: { status: ADOPTION_REQUEST_STATUSES.DECLINED, decidedAt: new Date(), decidedBy: actor.id } }
  );

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'idea.remove',
    targetType: 'idea',
    targetId: idea._id,
    scope: { collegeId: idea.collegeId },
    reason,
    ip,
  });

  return { ...idea.toObject(), _id: String(idea._id), id: String(idea._id) };
}

export async function requestIdeaAdoption(ideaId, { projectId }, { actor }) {
  const idea = await Idea.findById(ideaId).lean();
  if (!idea || idea.status !== IDEA_STATUSES.OPEN) {
    throw AppError.notFound();
  }

  const student = await findUserBasicById(actor.id);
  if (!student) throw AppError.forbidden();
  if (idea.collegeId && String(idea.collegeId) !== String(student.collegeId)) {
    throw AppError.businessRule('CROSS_COLLEGE_NOT_ALLOWED');
  }

  const duplicate = await AdoptionRequest.findOne({
    ideaId: idea._id,
    requestedBy: student._id,
    status: ADOPTION_REQUEST_STATUSES.PENDING,
  }).lean();
  if (duplicate) {
    throw new AppError('CONFLICT');
  }

  const created = await AdoptionRequest.create({
    ideaId: idea._id,
    requestedBy: student._id,
    projectId: projectId || null,
  });

  await sendNotification({
    userId: idea.ownerId,
    type: 'idea_adoption_request',
    titleKey: 'nav.ideas',
    bodyKey: 'timeline.proposalCreated',
    vars: { title: idea.title },
    link: '/app/ideas',
  });

  return { ...created.toObject(), _id: String(created._id), id: String(created._id) };
}

export async function listMyIdeasAdoptionRequests(ownerId) {
  const ideas = await Idea.find({ ownerId }).select('_id title').lean();
  if (ideas.length === 0) return [];
  const ideaMap = new Map(ideas.map((i) => [String(i._id), i]));
  const requests = await AdoptionRequest.find({
    ideaId: mongoose.trusted({ $in: ideas.map((i) => i._id) }),
    status: ADOPTION_REQUEST_STATUSES.PENDING,
  })
    .sort({ createdAt: -1 })
    .lean();

  const requesterMap = await findUsersBasicByIds(requests.map((r) => r.requestedBy));
  return requests.map((r) => ({
    ...r,
    _id: String(r._id),
    id: String(r._id),
    ideaTitle: ideaMap.get(String(r.ideaId))?.title || '',
    requesterName: requesterMap.get(String(r.requestedBy))?.name || '',
  }));
}

export async function decideAdoptionRequest(requestId, decision, { actor }) {
  const session = await mongoose.startSession();
  try {
    let outcome;
    await session.withTransaction(async () => {
      const reqDoc = await AdoptionRequest.findOne({
        _id: requestId,
        status: ADOPTION_REQUEST_STATUSES.PENDING,
      }).session(session);
      if (!reqDoc) throw AppError.notFound();

      const idea = await Idea.findById(reqDoc.ideaId).session(session);
      if (!idea || idea.status !== IDEA_STATUSES.OPEN) {
        throw new AppError('INVALID_TRANSITION');
      }

      if (decision === 'decline') {
        reqDoc.status = ADOPTION_REQUEST_STATUSES.DECLINED;
        reqDoc.decidedAt = new Date();
        reqDoc.decidedBy = actor.id;
        await reqDoc.save({ session });
        outcome = { request: reqDoc.toObject(), idea: idea.toObject() };
        return;
      }

      const student = await findUserBasicById(reqDoc.requestedBy, session);
      if (!student || !student.collegeId || !student.departmentId) {
        throw AppError.notFound();
      }

      const { currentYear } = await getCollegeAndCurrentYear(student.collegeId);
      if (!currentYear || !isRegistrationOpen(currentYear.cycle)) {
        throw new AppError('WINDOW_CLOSED', { details: getCycleWindowDates(currentYear?.cycle) });
      }

      const project = await createDraftProjectRecord({
        payload: {
          title: idea.title,
          idea: idea.description,
          problem: idea.description,
          objectives: [idea.title],
          scope: idea.description.slice(0, 200),
          field: idea.field,
          type: idea.type,
          beneficiaries: student.name,
          keywords: [],
          expectedOutcomes: idea.description.slice(0, 200),
          ideaId: idea._id,
          preferredSupervisorId: idea.ownerKind === 'supervisor' ? idea.ownerId : null,
        },
        leader: student,
        academicYear: currentYear,
        eventName: 'ADOPT_IDEA',
        session,
      });

      idea.status = IDEA_STATUSES.TAKEN;
      idea.takenByProjectId = project._id;
      await idea.save({ session });

      reqDoc.status = ADOPTION_REQUEST_STATUSES.ACCEPTED;
      reqDoc.projectId = project._id;
      reqDoc.decidedAt = new Date();
      reqDoc.decidedBy = actor.id;
      await reqDoc.save({ session });

      await AdoptionRequest.updateMany(
        {
          ideaId: idea._id,
          status: ADOPTION_REQUEST_STATUSES.PENDING,
          _id: mongoose.trusted({ $ne: reqDoc._id }),
        },
        {
          $set: {
            status: ADOPTION_REQUEST_STATUSES.DECLINED,
            decidedAt: new Date(),
            decidedBy: actor.id,
          },
        },
        { session }
      );

      const [hydratedProject] = await hydrateProjects([project]);
      outcome = {
        idea: { ...idea.toObject(), _id: String(idea._id), id: String(idea._id) },
        project: hydratedProject,
      };
    });

    return outcome;
  } finally {
    await session.endSession();
  }
}
