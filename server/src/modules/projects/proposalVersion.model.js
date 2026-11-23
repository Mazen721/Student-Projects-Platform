import mongoose from 'mongoose';

const proposalVersionSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    version: { type: Number, required: true, min: 1 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

proposalVersionSchema.index({ projectId: 1, version: -1 }, { unique: true });

const ProposalVersion =
  mongoose.models.ProposalVersion || mongoose.model('ProposalVersion', proposalVersionSchema);
export default ProposalVersion;
