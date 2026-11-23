import mongoose from 'mongoose';
import { TASK_COLUMNS, TASK_COLUMN_VALUES } from '@spp/shared/constants';

const taskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    column: { type: String, enum: TASK_COLUMN_VALUES, default: TASK_COLUMNS.TODO },
    order: { type: String, default: 'a0', maxlength: 64 },
    assigneeIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    dueDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sourceMeetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, column: 1, order: 1 });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export default Task;
