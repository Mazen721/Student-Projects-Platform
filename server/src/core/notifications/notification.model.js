import mongoose from 'mongoose';

const READ_NOTIFICATION_TTL_SECONDS = 180 * 24 * 60 * 60;

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, trim: true },
    titleKey: { type: String, required: true, trim: true },
    bodyKey: { type: String, required: true, trim: true },
    vars: { type: mongoose.Schema.Types.Mixed, default: {} },
    link: { type: String, trim: true },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, trim: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
notificationSchema.index(
  { readAt: 1 },
  {
    expireAfterSeconds: READ_NOTIFICATION_TTL_SECONDS,
    partialFilterExpression: { readAt: { $type: 'date' } },
  }
);

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
