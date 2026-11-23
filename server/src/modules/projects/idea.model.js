import mongoose from 'mongoose';
import {
  IDEA_STATUSES,
  IDEA_STATUS_VALUES,
  PROJECT_FIELD_VALUES,
  PROJECT_TYPE_VALUES,
} from '@spp/shared/constants';
import { normalizeArabic } from '@spp/shared/text';

const ideaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    titleNormalized: { type: String, trim: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    field: { type: String, enum: PROJECT_FIELD_VALUES, required: true },
    type: { type: String, enum: PROJECT_TYPE_VALUES, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerKind: { type: String, enum: ['supervisor', 'investor'], required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    status: { type: String, enum: IDEA_STATUS_VALUES, default: IDEA_STATUSES.OPEN },
    takenByProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    removedReason: { type: String, trim: true, maxlength: 500 },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ideaSchema.pre('validate', function syncIdeaNormalizedTitle(next) {
  if (this.title) {
    this.titleNormalized = normalizeArabic(this.title);
  }
  next();
});

ideaSchema.index({ status: 1, collegeId: 1, createdAt: -1 });
ideaSchema.index({ ownerId: 1, createdAt: -1 });

const Idea = mongoose.models.Idea || mongoose.model('Idea', ideaSchema);
export default Idea;
