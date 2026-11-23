import mongoose from 'mongoose';
import { ADOPTION_REQUEST_STATUSES, ADOPTION_REQUEST_STATUS_VALUES } from '@spp/shared/constants';

const adoptionRequestSchema = new mongoose.Schema(
  {
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    status: {
      type: String,
      enum: ADOPTION_REQUEST_STATUS_VALUES,
      default: ADOPTION_REQUEST_STATUSES.PENDING,
    },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

adoptionRequestSchema.index({ ideaId: 1, status: 1 });
adoptionRequestSchema.index({ requestedBy: 1, createdAt: -1 });

const AdoptionRequest =
  mongoose.models.AdoptionRequest || mongoose.model('AdoptionRequest', adoptionRequestSchema);
export default AdoptionRequest;
