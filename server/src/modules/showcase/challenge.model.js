import mongoose from 'mongoose';
import {
  CHALLENGE_STATUS_VALUES,
  CHALLENGE_STATUSES,
  PROJECT_FIELD_VALUES,
} from '@spp/shared/constants';

const challengeSchema = new mongoose.Schema(
  {
    investorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    field: { type: String, enum: PROJECT_FIELD_VALUES, required: true },
    status: {
      type: String,
      enum: CHALLENGE_STATUS_VALUES,
      default: CHALLENGE_STATUSES.OPEN,
    },
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    removedReason: { type: String, trim: true, maxlength: 500 },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

challengeSchema.index({ status: 1, createdAt: -1 });
challengeSchema.index({ investorId: 1, createdAt: -1 });
challengeSchema.index({ field: 1, status: 1 });

const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
export default Challenge;
