import mongoose from 'mongoose';
import {
  RUBRIC_CRITERION_TARGET_VALUES,
  RUBRIC_STATUSES,
  RUBRIC_STATUS_VALUES,
  WEIGHT_TOLERANCE,
} from '@spp/shared/constants';

const criterionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    weight: { type: Number, required: true, min: 0.01, max: 100 },
    appliesTo: { type: String, enum: RUBRIC_CRITERION_TARGET_VALUES, required: true },
    maxScore: { type: Number, default: 100 },
  },
  { _id: false }
);

const rubricSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    supervisorPct: { type: Number, required: true, min: 0, max: 100 },
    committeePct: { type: Number, required: true, min: 0, max: 100 },
    criteria: {
      type: [criterionSchema],
      validate: [
        (arr) =>
          Array.isArray(arr) &&
          arr.length > 0 &&
          Math.abs(arr.reduce((sum, c) => sum + Number(c.weight || 0), 0) - 100) <= WEIGHT_TOLERANCE,
        'Rubric criteria weights must sum to 100',
      ],
    },
    status: {
      type: String,
      enum: RUBRIC_STATUS_VALUES,
      default: RUBRIC_STATUSES.ACTIVE,
    },
  },
  { timestamps: true }
);

rubricSchema.pre('validate', function validateSplit(next) {
  if (
    Math.abs(Number(this.supervisorPct || 0) + Number(this.committeePct || 0) - 100) >
    WEIGHT_TOLERANCE
  ) {
    this.invalidate('committeePct', 'Supervisor and committee percentages must sum to 100');
  }
  next();
});

rubricSchema.index({ collegeId: 1, academicYearId: 1, status: 1 });

const Rubric = mongoose.models.Rubric || mongoose.model('Rubric', rubricSchema);
export default Rubric;
