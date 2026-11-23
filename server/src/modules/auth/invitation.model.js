import mongoose from 'mongoose';
import { INVITATION_KIND_VALUES, ROLE_VALUES, SCOPE_TYPE_VALUES } from '@spp/shared/constants';

const INVITATION_RETENTION_SECONDS = 30 * 24 * 60 * 60;

const invitationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: INVITATION_KIND_VALUES, required: true },
    tokenHash: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: ROLE_VALUES },
    scopeType: { type: String, enum: SCOPE_TYPE_VALUES },
    scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', default: null },
    inviteeName: { type: String, trim: true, maxlength: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ createdBy: 1, createdAt: -1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: INVITATION_RETENTION_SECONDS });

const Invitation =
  mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
export default Invitation;
