import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  },
  { timestamps: true }
);

followSchema.index({ userId: 1, projectId: 1 }, { unique: true });
followSchema.index({ projectId: 1 });

const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);
export default Follow;
