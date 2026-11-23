import { MEDIA_KINDS, MEDIA_VISIBILITY, ROLES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { getSignedDeliveryUrl } from '../../core/uploads/cloudinarySign.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import { getProjectForTracking } from '../projects/index.js';
import MediaAlbum from './mediaAlbum.model.js';
import MediaItem from './mediaItem.model.js';

const ADMIN_ROLES_SET = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

function getActorRoleName(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  const admin = roles.find((r) => ADMIN_ROLES_SET.has(r.role));
  return admin?.role || roles[0]?.role || '';
}

function serializeMediaItem(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(plain._id),
    albumId: String(plain.albumId),
    projectId: String(plain.projectId),
    kind: plain.kind,
    file: plain.file || null,
    signedUrl: plain.file ? getSignedDeliveryUrl(plain.file) : null,
    link: plain.link || null,
    caption: plain.caption || '',
    visibility: plain.visibility || MEDIA_VISIBILITY.PRIVATE,
    createdBy: String(plain.createdBy),
    createdAt: plain.createdAt,
  };
}

export async function listProjectAlbums(projectId) {
  await getProjectForTracking(projectId);
  const [albums, items] = await Promise.all([
    MediaAlbum.find({ projectId }).sort({ order: 1, createdAt: 1 }).lean(),
    MediaItem.find({ projectId, removed: null }).sort({ createdAt: 1 }).lean(),
  ]);

  const itemsByAlbum = new Map();
  for (const item of items) {
    const key = String(item.albumId);
    if (!itemsByAlbum.has(key)) itemsByAlbum.set(key, []);
    itemsByAlbum.get(key).push(serializeMediaItem(item));
  }

  return albums.map((album) => ({
    id: String(album._id),
    projectId: String(album.projectId),
    title: album.title,
    order: album.order,
    items: itemsByAlbum.get(String(album._id)) || [],
    createdAt: album.createdAt,
  }));
}

export async function createMediaAlbum(projectId, { title }) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  const count = await MediaAlbum.countDocuments({ projectId: project._id });
  const album = await MediaAlbum.create({
    projectId: project._id,
    title,
    order: count + 1,
  });
  return {
    id: String(album._id),
    projectId: String(album.projectId),
    title: album.title,
    order: album.order,
    items: [],
    createdAt: album.createdAt,
  };
}

export async function addMediaItem(albumId, payload, { actor }) {
  const album = await MediaAlbum.findById(albumId).lean();
  if (!album) throw AppError.notFound();

  const project = await getProjectForTracking(album.projectId, { requireWritable: true });

  let verifiedFile = null;
  if (payload.kind === MEDIA_KINDS.PHOTO) {
    verifiedFile = await verifyUpload(payload.upload, {
      userId: actor.id,
      expectedPurpose: 'gallery',
      expectedProjectId: String(project._id),
    });
  }

  const item = await MediaItem.create({
    albumId: album._id,
    projectId: project._id,
    kind: payload.kind,
    file: verifiedFile,
    link: payload.kind === MEDIA_KINDS.VIDEO_LINK ? payload.link : null,
    caption: payload.caption || '',
    visibility: payload.visibility || MEDIA_VISIBILITY.PRIVATE,
    createdBy: actor.id,
  });

  return serializeMediaItem(item);
}

export async function updateMediaItem(itemId, payload) {
  const item = await MediaItem.findOne({ _id: itemId, removed: null });
  if (!item) throw AppError.notFound();
  await getProjectForTracking(item.projectId, { requireWritable: true });

  if (payload.caption !== undefined) item.caption = payload.caption;
  if (payload.visibility !== undefined) item.visibility = payload.visibility;
  await item.save();

  return serializeMediaItem(item);
}

export async function removeMediaItem(itemId, { reason }, { actor, ip }) {
  const item = await MediaItem.findOne({ _id: itemId, removed: null });
  if (!item) throw AppError.notFound();
  const project = await getProjectForTracking(item.projectId);

  const actorIsAdmin = ADMIN_ROLES_SET.has(getActorRoleName(actor));
  const actorIsTeamMember = (project.activeMemberIds || []).some(
    (id) => String(id) === String(actor.id)
  );
  if (actorIsAdmin && !actorIsTeamMember && (!reason || reason.trim().length < 3)) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'reason', code: 'validation.required', message: t('validation.required') }],
    });
  }

  item.removed = {
    by: actor.id,
    at: new Date(),
    reason: reason?.trim() || undefined,
  };
  await item.save();

  if (actorIsAdmin) {
    await recordAudit({
      actorId: actor.id,
      actorRole: getActorRoleName(actor),
      action: 'mediaItem.remove',
      targetType: 'mediaItem',
      targetId: item._id,
      scope: {
        collegeId: project.collegeId,
        departmentId: project.departmentId,
        projectId: project._id,
      },
      before: { kind: item.kind, visibility: item.visibility },
      after: { removed: true },
      reason: reason?.trim() || 'removed',
      ip,
    });
  }

  return { id: String(item._id), removed: true };
}

export async function listPublicProjectMedia(projectId) {
  const items = await MediaItem.find({
    projectId,
    visibility: MEDIA_VISIBILITY.PUBLIC,
    removed: null,
  })
    .sort({ createdAt: 1 })
    .lean();
  return items.map(serializeMediaItem);
}
