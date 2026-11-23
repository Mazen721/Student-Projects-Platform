import mongoose from 'mongoose';
import {
  DEFAULT_GRADE_SPREAD_THRESHOLD,
  DEFAULT_PASS_MARK,
  DEFAULT_REEVAL_WINDOW_DAYS,
  DEFAULT_SUPERVISOR_PRIMARY_CAP,
  MAX_UPLOAD_BYTES,
  ORG_STATUSES,
  ORG_STATUS_VALUES,
  TEAM_SIZE_MAX_BOUND,
  TEAM_SIZE_MIN_BOUND,
} from '@spp/shared/constants';
import { normalizeArabic } from '@spp/shared/text';

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameNormalized: { type: String, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    status: { type: String, enum: ORG_STATUS_VALUES, default: ORG_STATUSES.ACTIVE },
    settings: {
      teamSizeMin: {
        type: Number,
        default: 1,
        min: TEAM_SIZE_MIN_BOUND,
        max: TEAM_SIZE_MAX_BOUND,
      },
      teamSizeMax: {
        type: Number,
        default: 5,
        min: TEAM_SIZE_MIN_BOUND,
        max: TEAM_SIZE_MAX_BOUND,
      },
      allowCrossCollege: { type: Boolean, default: false },
      supervisorPrimaryCap: {
        type: Number,
        default: DEFAULT_SUPERVISOR_PRIMARY_CAP,
        min: 1,
      },
      passMark: { type: Number, default: DEFAULT_PASS_MARK, min: 0, max: 100 },
      gradeSpreadThreshold: {
        type: Number,
        default: DEFAULT_GRADE_SPREAD_THRESHOLD,
        min: 1,
        max: 100,
      },
      reevaluationWindowDays: { type: Number, default: DEFAULT_REEVAL_WINDOW_DAYS, min: 0 },
      uploadLimits: {
        maxBytes: { type: Number, default: MAX_UPLOAD_BYTES, max: MAX_UPLOAD_BYTES },
      },
    },
  },
  { timestamps: true }
);

collegeSchema.pre('validate', function syncNormalizedName(next) {
  if (this.name) {
    this.nameNormalized = normalizeArabic(this.name);
  }
  next();
});

collegeSchema.index({ status: 1 });
collegeSchema.index({ code: 1 }, { unique: true });
collegeSchema.index({ nameNormalized: 1 }, { unique: true });

const College = mongoose.models.College || mongoose.model('College', collegeSchema);
export default College;
