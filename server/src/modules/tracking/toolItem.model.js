import mongoose from 'mongoose';
import { TOOL_CATEGORY_VALUES } from '@spp/shared/constants';

const toolItemSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    category: { type: String, enum: TOOL_CATEGORY_VALUES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    version: { type: String, trim: true, maxlength: 40 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

toolItemSchema.index({ projectId: 1 });
toolItemSchema.index({ collegeId: 1, academicYearId: 1 });
toolItemSchema.index({ academicYearLabel: 1 });

const ToolItem = mongoose.models.ToolItem || mongoose.model('ToolItem', toolItemSchema);
export default ToolItem;
