import Notification from './notification.model.js';

let ioInstance = null;

export function setNotificationSocket(io) {
  ioInstance = io;
}

async function emitUnreadUpdate(userId, notificationDoc) {
  if (!ioInstance) return;
  const unread = await Notification.countDocuments({ userId, readAt: null });
  const room = `user:${String(userId)}`;
  if (notificationDoc) {
    ioInstance.to(room).emit('notification:new', {
      id: String(notificationDoc._id),
      type: notificationDoc.type,
      titleKey: notificationDoc.titleKey,
      bodyKey: notificationDoc.bodyKey,
      vars: notificationDoc.vars,
      link: notificationDoc.link,
      createdAt: notificationDoc.createdAt,
    });
  }
  ioInstance.to(room).emit('notification:count', { unread });
}

export async function sendNotification({
  userId,
  type,
  titleKey,
  bodyKey,
  vars = {},
  link = '',
  dedupeKey,
  session,
}) {
  try {
    const docData = {
      userId,
      type,
      titleKey,
      bodyKey,
      vars,
      link,
      ...(dedupeKey ? { dedupeKey } : {}),
    };
    const [created] = await Notification.create([docData], session ? { session } : undefined);
    await emitUnreadUpdate(userId, created);
    return created;
  } catch (err) {
    if (err?.code === 11000 && dedupeKey) {
      return null;
    }
    throw err;
  }
}

export async function sendBulkNotifications(entries = [], { session } = {}) {
  const results = [];
  for (const entry of entries) {
    const created = await sendNotification({ ...entry, session });
    if (created) results.push(created);
  }
  return results;
}
