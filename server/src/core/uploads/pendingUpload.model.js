import mongoose from 'mongoose';
import { UPLOAD_PURPOSE_VALUES } from '@spp/shared/constants';

const PENDING_UPLOAD_TTL_SECONDS = 24 * 60 * 60;

const pendingUploadSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    purpose: { type: String, enum: UPLOAD_PURPOSE_VALUES, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    folder: { type: String, required: true, trim: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    deliveryType: { type: String, enum: ['upload', 'authenticated'], required: true },
    allowedFormats: [{ type: String, trim: true }],
    maxBytes: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

pendingUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: PENDING_UPLOAD_TTL_SECONDS });

const PendingUpload =
  mongoose.models.PendingUpload || mongoose.model('PendingUpload', pendingUploadSchema);
export default PendingUpload;
