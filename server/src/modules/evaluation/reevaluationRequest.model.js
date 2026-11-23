import mongoose from 'mongoose';
import { REEVALUATION_STATUSES, REEVALUATION_STATUS_VALUES } from '@spp/shared/constants';

const reevaluationRequestSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    scope: { type: String, enum: ['student', 'project'], required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterRole: { type: String, enum: ['student', 'supervisor'], required: true },
    reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 1500 },
    status: {
      type: String,
      enum: REEVALUATION_STATUS_VALUES,
      default: REEVALUATION_STATUSES.PENDING,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    replacementCommitteeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Committee',
      default: null,
    },
    oldGrades: { type: [mongoose.Schema.Types.Mixed], default: [] },
    newGrades: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

reevaluationRequestSchema.index({ projectId: 1, studentId: 1 }, { unique: true });
reevaluationRequestSchema.index({ collegeId: 1, status: 1, createdAt: -1 });

const ReEvaluationRequest =
  mongoose.models.ReEvaluationRequest ||
  mongoose.model('ReEvaluationRequest', reevaluationRequestSchema);
export default ReEvaluationRequest;
