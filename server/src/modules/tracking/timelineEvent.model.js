import mongoose from 'mongoose';

const timelineEventSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    type: { type: String, required: true, trim: true, maxlength: 60 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refType: { type: String, trim: true, maxlength: 40 },
    refId: { type: mongoose.Schema.Types.ObjectId },
    summaryKey: { type: String, required: true, trim: true, maxlength: 100 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

timelineEventSchema.index({ projectId: 1, at: -1 });

const TimelineEvent =
  mongoose.models.TimelineEvent || mongoose.model('TimelineEvent', timelineEventSchema);
export default TimelineEvent;
