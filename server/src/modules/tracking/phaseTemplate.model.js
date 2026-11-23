import mongoose from 'mongoose';
import { PHASE_TEMPLATE_STATUSES, PHASE_TEMPLATE_STATUS_VALUES } from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const requiredDeliverableDefSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    allowedTypes: { type: [String], default: [] },
  },
  { _id: false }
);

const phaseDefSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: Number, required: true, min: 1 },
    weight: { type: Number, required: true, min: 0, max: 100 },
    dueDate: { type: Date },
    dueOffsetDays: { type: Number, min: 1, max: 365 },
    requiredDeliverables: { type: [requiredDeliverableDefSchema], default: [] },
    forms: { type: [fileRefSchema], default: [] },
  },
  { _id: false }
);

const phaseTemplateSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    isDefault: { type: Boolean, default: true },
    status: {
      type: String,
      enum: PHASE_TEMPLATE_STATUS_VALUES,
      default: PHASE_TEMPLATE_STATUSES.ACTIVE,
    },
    phases: { type: [phaseDefSchema], default: [] },
  },
  { timestamps: true }
);

phaseTemplateSchema.index({ collegeId: 1, status: 1, isDefault: -1 });

const PhaseTemplate =
  mongoose.models.PhaseTemplate || mongoose.model('PhaseTemplate', phaseTemplateSchema);
export default PhaseTemplate;
