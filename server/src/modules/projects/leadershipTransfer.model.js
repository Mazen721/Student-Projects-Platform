import mongoose from 'mongoose';
import { TRANSFER_STATUSES, TRANSFER_STATUS_VALUES } from '@spp/shared/constants';

const leadershipTransferSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: TRANSFER_STATUS_VALUES, default: TRANSFER_STATUSES.PENDING },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leadershipTransferSchema.index({ projectId: 1, status: 1 });
leadershipTransferSchema.index({ toUserId: 1, status: 1 });

const LeadershipTransfer =
  mongoose.models.LeadershipTransfer || mongoose.model('LeadershipTransfer', leadershipTransferSchema);
export default LeadershipTransfer;
