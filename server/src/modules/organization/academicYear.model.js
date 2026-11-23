import mongoose from 'mongoose';
import { ACADEMIC_YEAR_STATUSES, ACADEMIC_YEAR_STATUS_VALUES } from '@spp/shared/constants';

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { _id: true }
);

const academicYearSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    label: { type: String, required: true, trim: true, match: /^\d{4}\/\d{4}$/ },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
    semesters: { type: [semesterSchema], default: [] },
    cycle: {
      registrationOpensAt: { type: Date, required: true },
      registrationClosesAt: { type: Date, required: true },
      proposalDeadline: { type: Date, required: true },
      defenseStart: { type: Date },
      defenseEnd: { type: Date },
    },
    status: {
      type: String,
      enum: ACADEMIC_YEAR_STATUS_VALUES,
      default: ACADEMIC_YEAR_STATUSES.ACTIVE,
    },
  },
  { timestamps: true }
);

academicYearSchema.index(
  { collegeId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
academicYearSchema.index({ collegeId: 1, startDate: -1 });

const AcademicYear =
  mongoose.models.AcademicYear || mongoose.model('AcademicYear', academicYearSchema);
export default AcademicYear;
