import mongoose from 'mongoose';
import { LINK_KIND_VALUES, SUBMISSION_DECISION_VALUES } from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const linkRefSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: LINK_KIND_VALUES, required: true },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    title: { type: String, trim: true, maxlength: 150 },
  },
  { _id: false }
);

const reviewEntrySchema = new mongoose.Schema(
  {
    decision: { type: String, enum: SUBMISSION_DECISION_VALUES, required: true },
    comment: { type: String, trim: true, maxlength: 1500 },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    deliverableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deliverable', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1 },
    isLatest: { type: Boolean, default: true },
    files: { type: [fileRefSchema], default: [] },
    links: { type: [linkRefSchema], default: [] },
    note: { type: String, trim: true, maxlength: 1000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    review: { type: reviewEntrySchema, default: null },
    reviewHistory: { type: [reviewEntrySchema], default: [] },
  },
  { timestamps: true }
);

submissionSchema.index({ deliverableId: 1, version: -1 }, { unique: true });
submissionSchema.index({ collegeId: 1, academicYearId: 1, isLatest: 1, isLate: 1 });
submissionSchema.index({ academicYearLabel: 1, isLatest: 1, isLate: 1 });
submissionSchema.index({ projectId: 1, submittedAt: -1 });

const Submission =
  mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
export default Submission;
