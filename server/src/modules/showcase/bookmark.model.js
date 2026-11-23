import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, projectId: 1 }, { unique: true });
bookmarkSchema.index({ projectId: 1 });

const Bookmark = mongoose.models.Bookmark || mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
