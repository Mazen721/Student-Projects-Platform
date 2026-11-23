import mongoose from 'mongoose';
import { GRADE_BAND_VALUES } from '@spp/shared/constants';
import { AppError } from '../../core/errors/AppError.js';

const perCriterionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    supervisor: { type: Number, required: true },
    committeeAvg: { type: Number, required: true },
  },
  { _id: false }
);

const gradeSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1 },
    isLatest: { type: Boolean, default: true },
    supervisorTotal: { type: Number, required: true, min: 0, max: 100 },
    committeeAvg: { type: Number, required: true, min: 0, max: 100 },
    final: { type: Number, required: true, min: 0, max: 100 },
    teamGrade: { type: Number, required: true, min: 0, max: 100 },
    perCriterion: { type: [perCriterionSchema], default: [] },
    passed: { type: Boolean, required: true },
    band: { type: String, enum: GRADE_BAND_VALUES, required: true },
    locked: { type: Boolean, default: true },
    finalizedAt: { type: Date, required: true },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    finalizeNote: { type: String, trim: true, maxlength: 1500 },
    reevaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReEvaluationRequest',
      default: null,
    },
  },
  { timestamps: true }
);

gradeSchema.pre('save', function enforceLockedSave(next) {
  if (!this.isNew && this.locked && !this.$locals?.allowSupersede) {
    return next(new AppError('GRADE_LOCKED'));
  }
  return next();
});

const LOCKED_UPDATE_HOOKS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findByIdAndUpdate',
  'replaceOne',
];

for (const hook of LOCKED_UPDATE_HOOKS) {
  gradeSchema.pre(hook, function enforceLockedUpdate(next) {
    if (this.getOptions()?.allowSupersede) {
      return next();
    }
    return next(new AppError('GRADE_LOCKED'));
  });
}

gradeSchema.index({ projectId: 1, studentId: 1, version: -1 });
gradeSchema.index({ collegeId: 1, academicYearId: 1, locked: 1, isLatest: 1 });
gradeSchema.index({ academicYearLabel: 1, locked: 1, isLatest: 1 });
gradeSchema.index({ studentId: 1, academicYearId: 1 });

const Grade = mongoose.models.Grade || mongoose.model('Grade', gradeSchema);
export default Grade;
