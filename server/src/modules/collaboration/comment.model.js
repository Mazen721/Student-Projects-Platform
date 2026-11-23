import mongoose from 'mongoose';

const removedMetaSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['submission', 'deliverable', 'task'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    removed: { type: removedMetaSchema, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ targetType: 1, targetId: 1, createdAt: 1 });
commentSchema.index({ projectId: 1, createdAt: -1 });

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
export default Comment;
