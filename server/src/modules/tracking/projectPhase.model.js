import mongoose from 'mongoose';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    dueDate: { type: Date, required: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: true }
);

const projectPhaseSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PhaseTemplate', required: true },
    key: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: Number, required: true, min: 1 },
    weight: { type: Number, required: true, min: 0, max: 100 },
    dueDate: { type: Date, required: true },
    forms: { type: [fileRefSchema], default: [] },
    requiredCount: { type: Number, default: 0, min: 0 },
    completedBySupervisor: {
      type: new mongoose.Schema(
        {
          by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: true }
);

projectPhaseSchema.index({ projectId: 1, order: 1 });

const ProjectPhase =
  mongoose.models.ProjectPhase || mongoose.model('ProjectPhase', projectPhaseSchema);
export default ProjectPhase;
