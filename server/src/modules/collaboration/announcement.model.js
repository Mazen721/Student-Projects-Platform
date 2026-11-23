import mongoose from 'mongoose';
import { SCOPE_TYPES } from '@spp/shared/constants';

const announcementSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scopeType: {
      type: String,
      enum: [SCOPE_TYPES.UNIVERSITY, SCOPE_TYPES.COLLEGE, SCOPE_TYPES.DEPARTMENT, 'supervision'],
      required: true,
    },
    scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    audienceCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

announcementSchema.index({ scopeType: 1, scopeId: 1, createdAt: -1 });
announcementSchema.index({ authorId: 1, createdAt: -1 });

const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
export default Announcement;
