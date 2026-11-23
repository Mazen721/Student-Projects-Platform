import mongoose from 'mongoose';
import PendingUpload from '../core/uploads/pendingUpload.model.js';
import Notification from '../core/notifications/notification.model.js';
import { purgeExpiredStatsCaches } from '../modules/reports/index.js';

const PENDING_UPLOAD_CUTOFF_MS = 24 * 60 * 60 * 1000;
const READ_NOTIFICATION_CUTOFF_MS = 180 * 24 * 60 * 60 * 1000;
const STATS_CACHE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

export async function runCleanupJob() {
  const now = Date.now();
  const [uploadRes, notifRes, removedStatsCaches] = await Promise.all([
    PendingUpload.deleteMany({
      createdAt: mongoose.trusted({ $lt: new Date(now - PENDING_UPLOAD_CUTOFF_MS) }),
    }),
    Notification.deleteMany({
      readAt: mongoose.trusted({ $type: 'date', $lt: new Date(now - READ_NOTIFICATION_CUTOFF_MS) }),
    }),
    purgeExpiredStatsCaches(new Date(now - STATS_CACHE_CUTOFF_MS)),
  ]);

  return {
    removedPendingUploads: uploadRes.deletedCount || 0,
    removedReadNotifications: notifRes.deletedCount || 0,
    removedStatsCaches,
  };
}
