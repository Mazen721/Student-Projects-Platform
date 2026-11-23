import mongoose from 'mongoose';
import {
  CHANNEL_KINDS,
  MAX_CHAT_LIMIT,
  ROLES,
  SCOPE_TYPES,
} from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { normalizeArabic } from '@spp/shared/text';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import Notification from '../../core/notifications/notification.model.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { searchChannelMessages } from '../../core/search/searchProvider.js';
import { getSignedDeliveryUrl } from '../../core/uploads/cloudinarySign.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import { emitToChannel, emitToUser, evictUserFromChannel } from '../../realtime/socket.js';
import { findUsersBasicByIds, listActiveStaffAndStudentIdsInScope } from '../auth/index.js';
import { resolveScopeHierarchy } from '../organization/index.js';
import {
  getProjectForTracking,
  getUserProjectScopeSummary,
  listAnnouncementProjectRecipients,
} from '../projects/index.js';
import { getCommentTargetProjectId } from '../tracking/index.js';
import Announcement from './announcement.model.js';
import Channel from './channel.model.js';
import Comment from './comment.model.js';
import Message from './message.model.js';

function uniqueObjectIds(ids = []) {
  const seen = new Set();
  const result = [];
  for (const raw of ids) {
    if (!raw) continue;
    const str = String(raw);
    if (!seen.has(str)) {
      seen.add(str);
      result.push(new mongoose.Types.ObjectId(str));
    }
  }
  return result;
}

function getActorRoleName(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  return roles[0]?.role || '';
}

function serializeAttachment(att) {
  return {
    ...att,
    signedUrl: getSignedDeliveryUrl(att),
  };
}

function serializeMessage(doc, userMap, replyMap = new Map()) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = String(plain._id);
  const sender = userMap.get(String(plain.senderId));
  const isRemoved = Boolean(plain.removed?.at);
  const replyDoc = plain.replyToId ? replyMap.get(String(plain.replyToId)) : null;

  return {
    id,
    channelId: String(plain.channelId),
    senderId: String(plain.senderId),
    sender: sender
      ? { id: sender.id, name: sender.name, avatar: sender.avatar || null }
      : { id: String(plain.senderId), name: '', avatar: null },
    text: isRemoved ? t('chat.removedByAdmin') : plain.text || '',
    isRemoved,
    ...(isRemoved ? { tombstoneKey: 'chat.removedByAdmin' } : {}),
    attachments: isRemoved ? [] : (plain.attachments || []).map(serializeAttachment),
    replyToId: plain.replyToId ? String(plain.replyToId) : null,
    replyTo: replyDoc
      ? {
          id: String(replyDoc._id),
          text: replyDoc.removed?.at ? t('chat.removedByAdmin') : replyDoc.text || '',
          senderName: userMap.get(String(replyDoc.senderId))?.name || '',
        }
      : null,
    mentions: isRemoved ? [] : (plain.mentions || []).map(String),
    readBy: (plain.readBy || []).map((r) => ({ userId: String(r.userId), at: r.at })),
    createdAt: plain.createdAt,
  };
}

async function hydrateMessages(docs = []) {
  if (docs.length === 0) return [];
  const replyIds = docs.map((d) => d.replyToId).filter(Boolean);
  const replyDocs =
    replyIds.length > 0
      ? await Message.find({ _id: mongoose.trusted({ $in: replyIds }) })
          .select('_id senderId text removed')
          .lean()
      : [];
  const replyMap = new Map(replyDocs.map((r) => [String(r._id), r]));
  const userIds = [
    ...docs.map((d) => d.senderId),
    ...replyDocs.map((r) => r.senderId),
  ];
  const userMap = await findUsersBasicByIds(userIds);
  return docs.map((doc) => serializeMessage(doc, userMap, replyMap));
}

async function hydrateChannels(channels = [], viewerId) {
  if (channels.length === 0) return [];
  const memberUserIds = channels.flatMap((ch) => ch.memberIds || []);
  const channelIds = channels.map((ch) => ch._id);

  const [userMap, lastMessages] = await Promise.all([
    findUsersBasicByIds(memberUserIds),
    Message.aggregate([
      { $match: { channelId: { $in: channelIds } } },
      { $sort: { _id: -1 } },
      { $group: { _id: '$channelId', doc: { $first: '$$ROOT' } } },
    ]),
  ]);

  const lastMessageMap = new Map(lastMessages.map((entry) => [String(entry._id), entry.doc]));
  const lastSenderIds = lastMessages.map((entry) => entry.doc.senderId);
  const extraUsers = await findUsersBasicByIds(lastSenderIds);
  for (const [k, v] of extraUsers.entries()) userMap.set(k, v);

  return Promise.all(
    channels.map(async (ch) => {
      const memberEntry = (ch.members || []).find((m) => String(m.userId) === String(viewerId));
      const lastReadAt = memberEntry?.lastReadAt || new Date(0);
      const unreadCount = await Message.countDocuments({
        channelId: ch._id,
        senderId: mongoose.trusted({ $ne: viewerId }),
        removed: null,
        createdAt: mongoose.trusted({ $gt: lastReadAt }),
      });
      const rawLast = lastMessageMap.get(String(ch._id));

      return {
        id: String(ch._id),
        projectId: ch.projectId ? String(ch.projectId) : null,
        kind: ch.kind,
        title: ch.title || null,
        memberIds: (ch.memberIds || []).map(String),
        members: (ch.memberIds || [])
          .map((id) => userMap.get(String(id)))
          .filter(Boolean)
          .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar || null })),
        unreadCount,
        lastMessage: rawLast ? serializeMessage(rawLast, userMap) : null,
        updatedAt: ch.updatedAt,
      };
    })
  );
}

export async function provisionProjectChannels(project, { session = null } = {}) {
  const activeIds = (project.activeMemberIds || []).map(String);
  const supervisorIds = (project.supervisorIds || []).map(String);
  const groupMemberIds = uniqueObjectIds([...activeIds, ...supervisorIds]);
  const teamMemberIds = uniqueObjectIds(activeIds);

  const existing = await Channel.find({
    projectId: project._id,
    kind: mongoose.trusted({ $in: [CHANNEL_KINDS.PROJECT_GROUP, CHANNEL_KINDS.TEAM_ONLY] }),
  })
    .session(session || null)
    .lean();
  const existingKinds = new Set(existing.map((c) => c.kind));

  const toCreate = [];
  if (!existingKinds.has(CHANNEL_KINDS.PROJECT_GROUP)) {
    toCreate.push({
      projectId: project._id,
      kind: CHANNEL_KINDS.PROJECT_GROUP,
      memberIds: groupMemberIds,
      members: groupMemberIds.map((userId) => ({ userId })),
      title: project.title,
      collegeId: project.collegeId,
      departmentId: project.departmentId,
      academicYearId: project.academicYearId,
    });
  }
  if (!existingKinds.has(CHANNEL_KINDS.TEAM_ONLY)) {
    toCreate.push({
      projectId: project._id,
      kind: CHANNEL_KINDS.TEAM_ONLY,
      memberIds: teamMemberIds,
      members: teamMemberIds.map((userId) => ({ userId })),
      title: project.title,
      collegeId: project.collegeId,
      departmentId: project.departmentId,
      academicYearId: project.academicYearId,
    });
  }

  if (toCreate.length > 0) {
    await Channel.insertMany(toCreate, session ? { session } : undefined);
  }
}

function mergeChannelMembers(existingMembers = [], nextIds = []) {
  const prevMap = new Map(existingMembers.map((m) => [String(m.userId), m]));
  return nextIds.map((id) => prevMap.get(String(id)) || { userId: id, lastReadAt: null });
}

export async function syncProjectChannelMembers(project, { removedUserIds = [], session = null } = {}) {
  const channels = await Channel.find({
    projectId: project._id,
    kind: mongoose.trusted({ $in: [CHANNEL_KINDS.PROJECT_GROUP, CHANNEL_KINDS.TEAM_ONLY] }),
  }).session(session || null);

  if (channels.length === 0) return;

  const activeIds = (project.activeMemberIds || []).map(String);
  const supervisorIds = (project.supervisorIds || []).map(String);

  for (const channel of channels) {
    const targetIds =
      channel.kind === CHANNEL_KINDS.TEAM_ONLY
        ? uniqueObjectIds(activeIds)
        : uniqueObjectIds([...activeIds, ...supervisorIds]);
    channel.memberIds = targetIds;
    channel.members = mergeChannelMembers(channel.members, targetIds);
    await channel.save(session ? { session } : undefined);

    for (const removedId of removedUserIds) {
      evictUserFromChannel(removedId, channel._id);
    }
  }
}

export async function listMyChannels(actor) {
  const channels = await Channel.find({ memberIds: actor.id })
    .sort({ updatedAt: -1 })
    .lean();

  const teamChannelProjectIds = channels
    .filter((c) => c.kind === CHANNEL_KINDS.TEAM_ONLY && c.projectId)
    .map((c) => c.projectId);

  const supervisedProjectSet = new Set();
  for (const pid of teamChannelProjectIds) {
    const project = await getProjectForTracking(pid).catch(() => null);
    if (project && (project.supervisorIds || []).some((id) => String(id) === String(actor.id))) {
      supervisedProjectSet.add(String(pid));
    }
  }

  const filtered = channels.filter(
    (c) => !(c.kind === CHANNEL_KINDS.TEAM_ONLY && supervisedProjectSet.has(String(c.projectId)))
  );
  return hydrateChannels(filtered, actor.id);
}

export async function listProjectChannels(projectId, actor) {
  const project = await getProjectForTracking(projectId);
  const actorId = String(actor.id);
  const isTeamMember = (project.activeMemberIds || []).some((id) => String(id) === actorId);
  const isSupervisor = (project.supervisorIds || []).some((id) => String(id) === actorId);

  const channels = await Channel.find({ projectId: project._id }).sort({ kind: 1 }).lean();
  const visible = channels.filter((ch) => {
    if (ch.kind === CHANNEL_KINDS.TEAM_ONLY) {
      return isTeamMember && !isSupervisor;
    }
    if (ch.kind === CHANNEL_KINDS.DIRECT) {
      return (ch.memberIds || []).some((id) => String(id) === actorId);
    }
    return true;
  });

  return hydrateChannels(visible, actor.id);
}

export async function getOrCreateDirectChannel(projectId, payload, { actor }) {
  const project = await getProjectForTracking(projectId);
  const actorId = String(actor.id);
  const activeSet = new Set((project.activeMemberIds || []).map(String));
  const supervisorSet = new Set((project.supervisorIds || []).map(String));

  let studentId;
  let supervisorId;

  if (payload.supervisorId && activeSet.has(actorId)) {
    if (!supervisorSet.has(String(payload.supervisorId))) {
      throw AppError.notFound();
    }
    studentId = actorId;
    supervisorId = String(payload.supervisorId);
  } else if (payload.studentId && supervisorSet.has(actorId)) {
    if (!activeSet.has(String(payload.studentId))) {
      throw AppError.notFound();
    }
    studentId = String(payload.studentId);
    supervisorId = actorId;
  } else {
    throw AppError.notFound();
  }

  const pairIds = uniqueObjectIds([studentId, supervisorId]);
  const existing = await Channel.findOne({
    projectId: project._id,
    kind: CHANNEL_KINDS.DIRECT,
    memberIds: mongoose.trusted({ $all: pairIds, $size: 2 }),
  }).lean();

  if (existing) {
    const [hydrated] = await hydrateChannels([existing], actor.id);
    return { channel: hydrated, created: false };
  }

  const created = await Channel.create({
    projectId: project._id,
    kind: CHANNEL_KINDS.DIRECT,
    memberIds: pairIds,
    members: pairIds.map((userId) => ({ userId })),
    title: project.title,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
    academicYearId: project.academicYearId,
  });

  const [hydrated] = await hydrateChannels([created], actor.id);
  return { channel: hydrated, created: true };
}

export async function listChannelMessages(channelId, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), MAX_CHAT_LIMIT);
  const filter = { channelId };
  if (query.before) {
    filter._id = mongoose.trusted({ $lt: new mongoose.Types.ObjectId(query.before) });
  }

  const docs = await Message.find(filter).sort({ _id: -1 }).limit(limit).lean();
  return hydrateMessages(docs);
}

async function resolveProjectTitle(projectId) {
  if (!projectId) return '';
  const project = await getProjectForTracking(projectId).catch(() => null);
  return project?.title || '';
}

async function verifyChatAttachments(rawAttachments, { userId, projectId }) {
  const verified = [];
  for (const rawAtt of rawAttachments || []) {
    verified.push(
      await verifyUpload(rawAtt, {
        userId,
        expectedPurpose: 'chat',
        expectedProjectId: projectId ? String(projectId) : null,
      })
    );
  }
  return verified;
}

async function notifyUnreadAndMentions({ channel, actorId, allowedMentions }) {
  await Promise.all(
    (channel.members || [])
      .filter((member) => String(member.userId) !== String(actorId))
      .map(async (member) => {
        const unread = await Message.countDocuments({
          channelId: channel._id,
          senderId: mongoose.trusted({ $ne: member.userId }),
          removed: null,
          createdAt: mongoose.trusted({ $gt: member.lastReadAt || new Date(0) }),
        });
        emitToUser(member.userId, 'channel:unread', { channelId: String(channel._id), unread });
      })
  );

  if (allowedMentions.length > 0) {
    const projectTitle = await resolveProjectTitle(channel.projectId);
    await sendBulkNotifications(
      allowedMentions.map((userId) => ({
        userId,
        type: 'chat_mention',
        titleKey: 'chat.projectGroup',
        bodyKey: 'notifications.mentionedInChat',
        vars: { project: projectTitle },
        link: `/app/chat?channel=${channel._id}`,
      }))
    );
  }
}

export async function sendMessage(channelId, payload, { actor }) {
  const channel = await Channel.findById(channelId);
  if (!channel) throw AppError.notFound();

  const isMember = (channel.memberIds || []).some((id) => String(id) === String(actor.id));
  if (!isMember) throw AppError.notFound();

  const verifiedAttachments = await verifyChatAttachments(payload.attachments, {
    userId: actor.id,
    projectId: channel.projectId,
  });

  if (payload.replyToId) {
    const replyExists = await Message.exists({ _id: payload.replyToId, channelId: channel._id });
    if (!replyExists) throw AppError.notFound();
  }

  const memberIdSet = new Set((channel.memberIds || []).map(String));
  const allowedMentions = [...new Set((payload.mentions || []).map(String))].filter(
    (uid) => uid !== String(actor.id) && memberIdSet.has(uid)
  );

  const created = await Message.create({
    channelId: channel._id,
    senderId: actor.id,
    text: payload.text || '',
    textNormalized: normalizeArabic(payload.text || ''),
    attachments: verifiedAttachments,
    replyToId: payload.replyToId || null,
    mentions: allowedMentions,
    readBy: [{ userId: actor.id, at: new Date() }],
  });

  channel.updatedAt = new Date();
  await channel.save();

  const [serialized] = await hydrateMessages([created]);
  emitToChannel(channel._id, 'message:new', serialized);
  await notifyUnreadAndMentions({ channel, actorId: actor.id, allowedMentions });

  return serialized;
}

export async function markChannelRead(channelId, upToMessageId, { actor }) {
  const now = new Date();
  await Channel.updateOne(
    { _id: channelId, 'members.userId': actor.id },
    { $set: { 'members.$.lastReadAt': now } }
  );

  if (upToMessageId) {
    await Message.updateMany(
      {
        channelId,
        _id: mongoose.trusted({ $lte: new mongoose.Types.ObjectId(upToMessageId) }),
        'readBy.userId': mongoose.trusted({ $ne: new mongoose.Types.ObjectId(actor.id) }),
      },
      { $push: { readBy: { userId: actor.id, at: now } } }
    );
  }

  emitToChannel(channelId, 'receipt:update', {
    channelId: String(channelId),
    userId: String(actor.id),
    upToMessageId: upToMessageId ? String(upToMessageId) : null,
    at: now,
  });
  emitToUser(actor.id, 'channel:unread', { channelId: String(channelId), unread: 0 });
}

export async function searchMessagesInChannel(channelId, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const { items, total } = await searchChannelMessages(Message, {
    channelId: new mongoose.Types.ObjectId(channelId),
    q: query.q || '',
    skip,
    limit,
  });
  const hydrated = await hydrateMessages(items);
  return { items: hydrated, page: buildPageMeta({ page, limit, total }) };
}

export async function moderateMessage(messageId, { reason }, { actor, ip }) {
  const message = await Message.findById(messageId);
  if (!message) throw AppError.notFound();

  const channel = await Channel.findById(message.channelId).select('projectId collegeId departmentId').lean();
  const before = { text: message.text };
  message.removed = { by: actor.id, at: new Date(), reason };
  await message.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'message.remove',
    targetType: 'message',
    targetId: message._id,
    scope: {
      collegeId: channel?.collegeId || null,
      departmentId: channel?.departmentId || null,
      projectId: channel?.projectId || null,
    },
    before,
    after: { removed: true },
    reason,
    ip,
  });

  emitToChannel(message.channelId, 'message:removed', {
    messageId: String(message._id),
    channelId: String(message.channelId),
  });

  const [serialized] = await hydrateMessages([message]);
  return serialized;
}

function serializeComment(doc, userMap) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const author = userMap.get(String(plain.authorId));
  const isRemoved = Boolean(plain.removed?.at);
  return {
    id: String(plain._id),
    targetType: plain.targetType,
    targetId: String(plain.targetId),
    projectId: String(plain.projectId),
    authorId: String(plain.authorId),
    author: author
      ? { id: author.id, name: author.name, avatar: author.avatar || null }
      : { id: String(plain.authorId), name: '', avatar: null },
    text: isRemoved ? t('chat.removedByAdmin') : plain.text,
    isRemoved,
    parentId: plain.parentId ? String(plain.parentId) : null,
    mentions: isRemoved ? [] : (plain.mentions || []).map(String),
    createdAt: plain.createdAt,
  };
}

export async function listComments({ targetType, targetId }) {
  const docs = await Comment.find({ targetType, targetId }).sort({ createdAt: 1, _id: 1 }).lean();
  const userMap = await findUsersBasicByIds(docs.map((d) => d.authorId));
  return docs.map((d) => serializeComment(d, userMap));
}

export async function createComment(payload, { actor }) {
  const projectId = await getCommentTargetProjectId(payload.targetType, payload.targetId);
  const project = await getProjectForTracking(projectId);

  if (payload.parentId) {
    const parentExists = await Comment.exists({
      _id: payload.parentId,
      targetType: payload.targetType,
      targetId: payload.targetId,
    });
    if (!parentExists) throw AppError.notFound();
  }

  const projectParticipantSet = new Set([
    ...(project.activeMemberIds || []).map(String),
    ...(project.supervisorIds || []).map(String),
  ]);
  const allowedMentions = [...new Set((payload.mentions || []).map(String))].filter(
    (uid) => uid !== String(actor.id) && projectParticipantSet.has(uid)
  );

  const created = await Comment.create({
    targetType: payload.targetType,
    targetId: payload.targetId,
    projectId: project._id,
    authorId: actor.id,
    text: payload.text,
    parentId: payload.parentId || null,
    mentions: allowedMentions,
  });

  if (allowedMentions.length > 0) {
    await sendBulkNotifications(
      allowedMentions.map((userId) => ({
        userId,
        type: 'comment_mention',
        titleKey: 'chat.projectGroup',
        bodyKey: 'notifications.mentionedInChat',
        vars: { project: project.title },
        link: `/app/projects/${project._id}`,
      }))
    );
  }

  const userMap = await findUsersBasicByIds([actor.id]);
  return serializeComment(created, userMap);
}

export async function moderateComment(commentId, { reason }, { actor, ip }) {
  const comment = await Comment.findById(commentId);
  if (!comment) throw AppError.notFound();
  const project = await getProjectForTracking(comment.projectId).catch(() => null);

  const before = { text: comment.text };
  comment.removed = { by: actor.id, at: new Date(), reason };
  await comment.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'comment.remove',
    targetType: 'comment',
    targetId: comment._id,
    scope: {
      collegeId: project?.collegeId || null,
      departmentId: project?.departmentId || null,
      projectId: comment.projectId,
    },
    before,
    after: { removed: true },
    reason,
    ip,
  });

  const userMap = await findUsersBasicByIds([comment.authorId]);
  return serializeComment(comment, userMap);
}

function assertAnnouncementPermission(actor, scopeType, resolvedScope) {
  const assignments = Array.isArray(actor?.roles) ? actor.roles : [];
  if (assignments.some((a) => a.role === ROLES.UNIVERSITY_ADMIN)) return;

  if (scopeType === SCOPE_TYPES.UNIVERSITY) {
    throw AppError.forbidden();
  }
  if (scopeType === SCOPE_TYPES.COLLEGE) {
    const allowed = assignments.some(
      (a) =>
        a.role === ROLES.COLLEGE_ADMIN &&
        String(a.collegeId ?? a.scopeId) === String(resolvedScope.collegeId)
    );
    if (!allowed) throw AppError.notFound();
    return;
  }
  if (scopeType === SCOPE_TYPES.DEPARTMENT) {
    const allowed = assignments.some(
      (a) =>
        (a.role === ROLES.COLLEGE_ADMIN &&
          String(a.collegeId ?? a.scopeId) === String(resolvedScope.collegeId)) ||
        (a.role === ROLES.DEPARTMENT_ADMIN &&
          String(a.departmentId ?? a.scopeId) === String(resolvedScope.departmentId))
    );
    if (!allowed) throw AppError.notFound();
    return;
  }
  if (scopeType === 'supervision') {
    const allowed = assignments.some((a) =>
      [ROLES.SUPERVISOR, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(a.role)
    );
    if (!allowed) throw AppError.forbidden();
  }
}

export async function createAnnouncement(payload, { actor }) {
  const resolved =
    payload.scopeType === 'supervision'
      ? { scopeId: actor.id, collegeId: null, departmentId: null }
      : await resolveScopeHierarchy(payload.scopeType, payload.scopeId);

  assertAnnouncementPermission(actor, payload.scopeType, resolved);

  const [projectRecipients, scopedUsers] = await Promise.all([
    listAnnouncementProjectRecipients({
      scopeType: payload.scopeType,
      scopeId: resolved.scopeId,
      supervisorId: actor.id,
    }),
    payload.scopeType === 'supervision'
      ? []
      : listActiveStaffAndStudentIdsInScope({
          collegeId: resolved.collegeId,
          departmentId: resolved.departmentId,
        }),
  ]);

  const recipientSet = new Set([...projectRecipients, ...scopedUsers]);
  recipientSet.delete(String(actor.id));
  const recipientIds = Array.from(recipientSet);

  const announcement = await Announcement.create({
    authorId: actor.id,
    scopeType: payload.scopeType,
    scopeId: resolved.scopeId || null,
    title: payload.title,
    body: payload.body,
    audienceCount: recipientIds.length,
  });

  if (recipientIds.length > 0) {
    await sendBulkNotifications(
      recipientIds.map((userId) => ({
        userId,
        type: 'announcement',
        titleKey: 'chat.announcements',
        bodyKey: 'chat.announcementPublished',
        vars: { title: payload.title },
        link: '/app/announcements',
      }))
    );
  }

  return {
    id: String(announcement._id),
    authorId: String(announcement.authorId),
    scopeType: announcement.scopeType,
    scopeId: announcement.scopeId ? String(announcement.scopeId) : null,
    title: announcement.title,
    body: announcement.body,
    audienceCount: announcement.audienceCount,
    createdAt: announcement.createdAt,
  };
}

export async function listMyAnnouncements(actor, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const projScope = await getUserProjectScopeSummary(actor.id);

  const collegeIds = new Set(projScope.collegeIds);
  const deptIds = new Set(projScope.departmentIds);
  if (actor.collegeId) collegeIds.add(String(actor.collegeId));
  if (actor.departmentId) deptIds.add(String(actor.departmentId));

  const orClauses = [
    { scopeType: SCOPE_TYPES.UNIVERSITY },
    { authorId: actor.id },
  ];
  if (collegeIds.size > 0) {
    orClauses.push({
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: mongoose.trusted({ $in: [...collegeIds].map((id) => new mongoose.Types.ObjectId(id)) }),
    });
  }
  if (deptIds.size > 0) {
    orClauses.push({
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: mongoose.trusted({ $in: [...deptIds].map((id) => new mongoose.Types.ObjectId(id)) }),
    });
  }
  if (projScope.supervisorIds.length > 0) {
    orClauses.push({
      scopeType: 'supervision',
      scopeId: mongoose.trusted({
        $in: projScope.supervisorIds.map((id) => new mongoose.Types.ObjectId(id)),
      }),
    });
  }

  const filter = { $or: orClauses };
  const [docs, total] = await Promise.all([
    Announcement.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(filter),
  ]);

  const userMap = await findUsersBasicByIds(docs.map((d) => d.authorId));
  const items = docs.map((d) => ({
    id: String(d._id),
    authorId: String(d.authorId),
    authorName: userMap.get(String(d.authorId))?.name || '',
    scopeType: d.scopeType,
    scopeId: d.scopeId ? String(d.scopeId) : null,
    title: d.title,
    body: d.body,
    audienceCount: d.audienceCount,
    createdAt: d.createdAt,
  }));

  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function listMyNotifications(actor, query = {}) {
  const { page, limit, skip } = parsePagination(query, ['-createdAt']);
  const filter = { userId: actor.id };
  if (query.unread === 'true' || query.unread === true) {
    filter.readAt = null;
  }

  const [docs, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: actor.id, readAt: null }),
  ]);

  const items = docs.map((n) => ({
    id: String(n._id),
    type: n.type,
    titleKey: n.titleKey,
    bodyKey: n.bodyKey,
    vars: n.vars || {},
    link: n.link || '',
    readAt: n.readAt || null,
    createdAt: n.createdAt,
  }));

  return { items, page: buildPageMeta({ page, limit, total }), unreadCount };
}

export async function markNotificationsRead(payload, { actor }) {
  const now = new Date();
  const filter = { userId: actor.id, readAt: null };
  if (!payload.all && Array.isArray(payload.ids)) {
    filter._id = mongoose.trusted({
      $in: payload.ids.map((id) => new mongoose.Types.ObjectId(id)),
    });
  }
  await Notification.updateMany(filter, { $set: { readAt: now } });
  const unread = await Notification.countDocuments({ userId: actor.id, readAt: null });
  emitToUser(actor.id, 'notification:count', { unread });
}
