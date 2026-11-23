import mongoose from 'mongoose';
import { ORG_STATUSES, ORG_STATUS_VALUES } from '@spp/shared/constants';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    status: { type: String, enum: ORG_STATUS_VALUES, default: ORG_STATUSES.ACTIVE },
  },
  { timestamps: true }
);

departmentSchema.index({ collegeId: 1, status: 1 });
departmentSchema.index({ collegeId: 1, code: 1 }, { unique: true });

const Department =
  mongoose.models.Department || mongoose.model('Department', departmentSchema);
export default Department;
