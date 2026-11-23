import mongoose from 'mongoose';
import {
  CHALLENGE_STATUSES,
  CONTACT_REQUEST_STATES,
} from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { contactRequestMachine } from '@spp/shared/machines';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getUniversityShowcaseConfig } from '../organization/index.js';
import {
  getProjectForShowcase,
  incrementProjectShowcaseStats,
  listPublishedProjectsByIds,
} from '../projects/index.js';
import Bookmark from './bookmark.model.js';
import Challenge from './challenge.model.js';
import ContactRequest from './contactRequest.model.js';
import Follow from './follow.model.js';
import { hydratePublicCards } from './showcase.service.js';

function pickSharedContacts(raw = {}) {
  const result = {};
  if (raw.email) result.email = raw.email;
  if (raw.phone) result.phone = raw.phone;
  if (raw.other) result.other = raw.other;
  return result;
}

function serializeContactRequest(doc, { investorName, project } = {}) {
  return {
    id: String(doc._id),
    projectId: String(doc.projectId),
    investorId: String(doc.investorId),
    ...(investorName !== undefined ? { investorName } : {}),
    ...(project ? { project: { id: String(project._id), title: project.title, slug: project.slug } } : {}),
    message: doc.message,
    state: doc.state,
    ...(doc.reply
      ? {
          reply: {
            text: doc.reply.text,
            ...(doc.reply.sharedContacts
              ? { sharedContacts: pickSharedContacts(doc.reply.sharedContacts) }
              : {}),
          },
        }
      : {}),
    decidedAt: doc.decidedAt || null,
    createdAt: doc.createdAt,
  };
}

export async function followProject(projectId, { actor }) {
  const project = await getProjectForShowcase(projectId);
  if (!project.isPublished) throw AppError.notFound();

  const existing = await Follow.exists({ userId: actor.id, projectId: project._id });
  if (existing) {
    return { following: true, follows: project.showcaseStats?.follows || 0 };
  }

  let follows = project.showcaseStats?.follows || 0;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Follow.create([{ userId: actor.id, projectId: project._id }], { session });
      const updated = await incrementProjectShowcaseStats(project._id, { follows: 1 }, { session });
      follows = updated?.showcaseStats?.follows ?? follows + 1;
    });
  } finally {
    await session.endSession();
  }
  return { following: true, follows };
}

export async function unfollowProject(projectId, { actor }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const removed = await Follow.findOneAndDelete({ userId: actor.id, projectId }).session(session);
      if (removed) {
        await incrementProjectShowcaseStats(projectId, { follows: -1 }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function bookmarkProject(projectId, { actor }) {
  const project = await getProjectForShowcase(projectId);
  if (!project.isPublished) throw AppError.notFound();

  const existing = await Bookmark.exists({ userId: actor.id, projectId: project._id });
  if (existing) {
    return { bookmarked: true, bookmarks: project.showcaseStats?.bookmarks || 0 };
  }

  let bookmarks = project.showcaseStats?.bookmarks || 0;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Bookmark.create([{ userId: actor.id, projectId: project._id }], { session });
      const updated = await incrementProjectShowcaseStats(
        project._id,
        { bookmarks: 1 },
        { session }
      );
      bookmarks = updated?.showcaseStats?.bookmarks ?? bookmarks + 1;
    });
  } finally {
    await session.endSession();
  }
  return { bookmarked: true, bookmarks };
}

export async function unbookmarkProject(projectId, { actor }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const removed = await Bookmark.findOneAndDelete({ userId: actor.id, projectId }).session(
        session
      );
      if (removed) {
        await incrementProjectShowcaseStats(projectId, { bookmarks: -1 }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function listSavedProjects(Model, userId, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const [rows, total, uniConfig] = await Promise.all([
    Model.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Model.countDocuments({ userId }),
    getUniversityShowcaseConfig(),
  ]);

  const projects = await listPublishedProjectsByIds(rows.map((r) => r.projectId));
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));
  const ordered = rows.map((r) => projectMap.get(String(r.projectId))).filter(Boolean);
  const items = await hydratePublicCards(ordered, new Set(uniConfig.featuredProjectIds || []));

  return { items, page: buildPageMeta({ page, limit, total }) };
}

export function listMyFollows(userId, query = {}) {
  return listSavedProjects(Follow, userId, query);
}

export function listMyBookmarks(userId, query = {}) {
  return listSavedProjects(Bookmark, userId, query);
}

export async function createContactRequest(projectId, { message }, { actor }) {
  const project = await getProjectForShowcase(projectId);
  if (!project.isPublished) throw AppError.notFound();

  const doc = await ContactRequest.create({
    projectId: project._id,
    investorId: actor.id,
    message,
    state: CONTACT_REQUEST_STATES.PENDING,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
  });

  if (project.team?.leaderId) {
    await sendBulkNotifications([
      {
        userId: project.team.leaderId,
        type: 'contact_request_received',
        titleKey: 'notifications.contactRequestReceivedTitle',
        bodyKey: 'notifications.contactRequestReceivedBody',
        vars: { project: project.title },
        link: `/app/projects/${project._id}`,
      },
    ]);
  }

  return serializeContactRequest(doc);
}

export async function listProjectContactRequests(projectId, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const [docs, total] = await Promise.all([
    ContactRequest.find({ projectId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactRequest.countDocuments({ projectId }),
  ]);

  const usersMap = await findUsersBasicByIds(docs.map((d) => d.investorId));
  const items = docs.map((d) =>
    serializeContactRequest(d, { investorName: usersMap.get(String(d.investorId))?.name || '' })
  );
  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function decideContactRequest(requestId, { decision, reply }, { actor }) {
  const doc = await ContactRequest.findById(requestId);
  if (!doc) throw AppError.notFound();

  const project = await getProjectForShowcase(doc.projectId);
  if (String(project.team?.leaderId) !== String(actor.id)) {
    throw AppError.notFound();
  }

  const event = decision === 'accept' ? 'ACCEPT' : 'DECLINE';
  const evalResult = contactRequestMachine.evaluate(doc.state, event, { roles: ['leader'] });
  if (!evalResult.allowed) {
    throw evalResult.code === 'FORBIDDEN'
      ? AppError.forbidden()
      : new AppError('INVALID_TRANSITION');
  }

  if (decision === 'accept') {
    if (!reply?.text) {
      throw new AppError('VALIDATION_ERROR', {
        fields: [{ path: 'reply.text', code: 'validation.required', message: t('validation.required') }],
      });
    }
    const sharedContacts = pickSharedContacts(reply.sharedContacts);
    doc.reply = {
      text: reply.text,
      ...(Object.keys(sharedContacts).length > 0 ? { sharedContacts } : {}),
    };
  }

  doc.state = evalResult.to;
  doc.decidedBy = actor.id;
  doc.decidedAt = new Date();
  await doc.save();

  await sendBulkNotifications([
    {
      userId: doc.investorId,
      type: 'contact_request_decided',
      titleKey: 'notifications.contactRequestDecidedTitle',
      bodyKey: 'notifications.contactRequestDecidedBody',
      vars: { project: project.title, status: t(`statuses.${doc.state}`) },
      link: '/app/investor',
    },
  ]);

  return serializeContactRequest(doc);
}

export async function listMyContactRequests(userId, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const [docs, total] = await Promise.all([
    ContactRequest.find({ investorId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ContactRequest.countDocuments({ investorId: userId }),
  ]);

  const projectIds = [...new Set(docs.map((d) => String(d.projectId)))];
  const projectEntries = await Promise.all(
    projectIds.map((pid) => getProjectForShowcase(pid).catch(() => null))
  );
  const projectMap = new Map(
    projectEntries.filter(Boolean).map((p) => [String(p._id), p])
  );

  const items = docs.map((d) =>
    serializeContactRequest(d, { project: projectMap.get(String(d.projectId)) || null })
  );
  return { items, page: buildPageMeta({ page, limit, total }) };
}

function serializeChallenge(doc, investorName = '') {
  return {
    id: String(doc._id),
    investorId: String(doc.investorId),
    investorName,
    title: doc.title,
    description: doc.description,
    field: doc.field,
    status: doc.status,
    removedReason: doc.removedReason || null,
    createdAt: doc.createdAt,
  };
}

export async function listChallenges(query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const filter = { status: mongoose.trusted({ $ne: CHALLENGE_STATUSES.REMOVED }) };
  if (query.field) filter.field = query.field;

  const [docs, total] = await Promise.all([
    Challenge.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Challenge.countDocuments(filter),
  ]);

  const usersMap = await findUsersBasicByIds(docs.map((d) => d.investorId));
  const items = docs.map((d) =>
    serializeChallenge(d, usersMap.get(String(d.investorId))?.name || '')
  );
  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function createChallenge(payload, { actor }) {
  const doc = await Challenge.create({
    investorId: actor.id,
    title: payload.title,
    description: payload.description,
    field: payload.field,
    status: CHALLENGE_STATUSES.OPEN,
  });
  return serializeChallenge(doc, actor.name || '');
}

export async function removeChallenge(challengeId, { reason }, { actor, ip }) {
  if (!reason || !reason.trim()) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'reason', code: 'validation.required', message: t('validation.required') }],
    });
  }
  const doc = await Challenge.findById(challengeId);
  if (!doc) throw AppError.notFound();

  const prevStatus = doc.status;
  doc.status = CHALLENGE_STATUSES.REMOVED;
  doc.removedBy = actor.id;
  doc.removedReason = reason.trim();
  doc.removedAt = new Date();
  await doc.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actor?.roles?.[0]?.role || '',
    action: 'challenge.remove',
    targetType: 'challenge',
    targetId: doc._id,
    before: { status: prevStatus },
    after: { status: CHALLENGE_STATUSES.REMOVED },
    reason: reason.trim(),
    ip,
  });

  return serializeChallenge(doc);
}
