import { PUBLIC_COMMENT_STATES, ROLES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getProjectForShowcase, getPublishedProjectBySlug } from '../projects/index.js';
import PublicComment from './publicComment.model.js';

const STAFF_ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

const MODERATION_STATE_MAP = {
  hide: PUBLIC_COMMENT_STATES.HIDDEN,
  remove: PUBLIC_COMMENT_STATES.REMOVED,
  restore: PUBLIC_COMMENT_STATES.VISIBLE,
};

function serializeComment(doc, author) {
  return {
    id: String(doc._id),
    projectId: String(doc.projectId),
    parentId: doc.parentId ? String(doc.parentId) : null,
    text: doc.text,
    state: doc.state,
    author: author ? { name: author.name, avatar: author.avatar || null } : { name: '' },
    createdAt: doc.createdAt,
  };
}

export async function listPublicComments(slug, query = {}) {
  const project = await getPublishedProjectBySlug(slug);
  if (!project) throw AppError.notFound();

  const { page, limit, skip } = parsePagination(query, ['createdAt', '-createdAt']);
  const filter = { projectId: project._id, state: PUBLIC_COMMENT_STATES.VISIBLE };

  const [docs, total] = await Promise.all([
    PublicComment.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    PublicComment.countDocuments(filter),
  ]);

  const usersMap = await findUsersBasicByIds(docs.map((d) => d.authorId));
  const items = docs.map((d) => serializeComment(d, usersMap.get(String(d.authorId))));
  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function createPublicComment(projectId, { text, parentId }, { actor }) {
  const project = await getProjectForShowcase(projectId);
  if (!project.isPublished) throw AppError.notFound();

  if (parentId) {
    const parent = await PublicComment.findOne({ _id: parentId, projectId: project._id }).lean();
    if (!parent) throw AppError.notFound();
  }

  const doc = await PublicComment.create({
    projectId: project._id,
    authorId: actor.id,
    text,
    parentId: parentId || null,
    state: PUBLIC_COMMENT_STATES.VISIBLE,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
  });

  const usersMap = await findUsersBasicByIds([actor.id]);
  return serializeComment(doc, usersMap.get(String(actor.id)));
}

export async function reportPublicComment(commentId, { reason }, { actor }) {
  if (!reason || !reason.trim()) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'reason', code: 'validation.required', message: t('validation.required') }],
    });
  }
  const comment = await PublicComment.findById(commentId);
  if (!comment || comment.state === PUBLIC_COMMENT_STATES.REMOVED) {
    throw AppError.notFound();
  }

  comment.reports.push({ userId: actor.id, reason: reason.trim(), at: new Date() });
  await comment.save();

  return {
    id: String(comment._id),
    reported: true,
    reportsCount: comment.reports.length,
  };
}

export async function moderatePublicComment(commentId, { action, reason }, { actor, ip }) {
  const comment = await PublicComment.findById(commentId);
  if (!comment) throw AppError.notFound();

  const project = await getProjectForShowcase(comment.projectId);
  const nextState = MODERATION_STATE_MAP[action];
  const prevState = comment.state;

  const isTeam = (project.activeMemberIds || []).some((id) => String(id) === String(actor.id));
  const adminRole = (actor.roles || []).find((r) => STAFF_ADMIN_ROLES.has(r.role))?.role;

  comment.state = nextState;
  comment.moderatedBy = actor.id;
  comment.moderatedAt = new Date();
  comment.moderationReason = reason?.trim() || undefined;
  await comment.save();

  if (adminRole && !isTeam) {
    await recordAudit({
      actorId: actor.id,
      actorRole: adminRole,
      action: `publicComment.${action}`,
      targetType: 'publicComment',
      targetId: comment._id,
      scope: {
        collegeId: project.collegeId,
        departmentId: project.departmentId,
        projectId: project._id,
      },
      before: { state: prevState },
      after: { state: nextState },
      reason: reason?.trim(),
      ip,
    });
  }

  const usersMap = await findUsersBasicByIds([comment.authorId]);
  return serializeComment(comment, usersMap.get(String(comment.authorId)));
}
