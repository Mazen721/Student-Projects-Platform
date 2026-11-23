import mongoose from 'mongoose';
import { DELIVERABLE_STATUSES, DELIVERABLE_STATUS_VALUES } from '@spp/shared/constants';

const deliverableSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectPhase', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    key: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    allowedTypes: { type: [String], default: [] },
    required: { type: Boolean, default: true },
    dueDate: { type: Date, required: true },
    latestSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      default: null,
    },
    latestStatus: {
      type: String,
      enum: DELIVERABLE_STATUS_VALUES,
      default: DELIVERABLE_STATUSES.NONE,
    },
  },
  { timestamps: true }
);

deliverableSchema.index({ projectId: 1, phaseId: 1 });
deliverableSchema.index({ dueDate: 1, latestStatus: 1 });
deliverableSchema.index({ collegeId: 1, academicYearId: 1, latestStatus: 1 });

const Deliverable =
  mongoose.models.Deliverable || mongoose.model('Deliverable', deliverableSchema);
export default Deliverable;
