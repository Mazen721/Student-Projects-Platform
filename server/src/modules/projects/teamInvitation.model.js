import mongoose from 'mongoose';
import { TEAM_INVITATION_STATUSES, TEAM_INVITATION_STATUS_VALUES } from '@spp/shared/constants';

const teamInvitationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isLink: { type: Boolean, default: false },
    tokenHash: { type: String },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: TEAM_INVITATION_STATUS_VALUES,
      default: TEAM_INVITATION_STATUSES.PENDING,
    },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

teamInvitationSchema.index({ projectId: 1, status: 1 });
teamInvitationSchema.index({ inviteeId: 1, status: 1 });
teamInvitationSchema.index(
  { tokenHash: 1 },
  { unique: true, partialFilterExpression: { tokenHash: { $type: 'string' } } }
);

const TeamInvitation =
  mongoose.models.TeamInvitation || mongoose.model('TeamInvitation', teamInvitationSchema);
export default TeamInvitation;
