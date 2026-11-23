import mongoose from 'mongoose';

const PAGE_VIEW_TTL_SECONDS = 35 * 24 * 60 * 60;

const pageViewSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    visitorKey: { type: String, required: true },
    day: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: PAGE_VIEW_TTL_SECONDS },
  },
  { timestamps: false }
);

pageViewSchema.index({ projectId: 1, visitorKey: 1, day: 1 }, { unique: true });
pageViewSchema.index({ projectId: 1, day: 1 });

const PageView = mongoose.models.PageView || mongoose.model('PageView', pageViewSchema);
export default PageView;
