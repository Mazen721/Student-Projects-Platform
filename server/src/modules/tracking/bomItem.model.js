import mongoose from 'mongoose';
import { BOM_STATUSES, BOM_STATUS_VALUES } from '@spp/shared/constants';

const bomItemSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    item: { type: String, required: true, trim: true, maxlength: 150 },
    quantity: { type: Number, required: true, min: 1 },
    specs: { type: String, trim: true, maxlength: 500 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EGP' },
    supplier: { type: String, trim: true, maxlength: 150 },
    status: { type: String, enum: BOM_STATUS_VALUES, default: BOM_STATUSES.NEEDED },
  },
  { timestamps: true }
);

bomItemSchema.index({ projectId: 1 });
bomItemSchema.index({ collegeId: 1, academicYearId: 1 });
bomItemSchema.index({ academicYearLabel: 1 });

const BOMItem = mongoose.models.BOMItem || mongoose.model('BOMItem', bomItemSchema);
export default BOMItem;
