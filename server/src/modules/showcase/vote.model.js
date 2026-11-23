import mongoose from 'mongoose';
import { VOTE_STATUSES, VOTE_STATUS_VALUES } from '@spp/shared/constants';

const voteSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: VOTE_STATUS_VALUES, default: VOTE_STATUSES.VALID },
    ipHash: { type: String, default: '' },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

voteSchema.index({ projectId: 1, userId: 1 }, { unique: true });
voteSchema.index({ projectId: 1, status: 1, createdAt: -1 });
voteSchema.index({ status: 1, createdAt: -1 });
voteSchema.index({ collegeId: 1, departmentId: 1, status: 1 });

const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
export default Vote;
