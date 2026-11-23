import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: Date, required: true },
    attendeeIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    notes: { type: String, required: true, trim: true, maxlength: 3000 },
    actionItems: { type: [actionItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

meetingSchema.index({ projectId: 1, date: -1 });

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
export default Meeting;
