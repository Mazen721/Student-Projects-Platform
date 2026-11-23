import mongoose from 'mongoose';
import { SUPERVISION_KINDS } from '@spp/shared/constants';

const supervisorAssignmentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: Object.values(SUPERVISION_KINDS), required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    overrideReason: { type: String, trim: true, maxlength: 500 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supervisorAssignmentSchema.index({ supervisorId: 1, kind: 1, endedAt: 1 });
supervisorAssignmentSchema.index({ projectId: 1, startedAt: -1 });

const SupervisorAssignment =
  mongoose.models.SupervisorAssignment ||
  mongoose.model('SupervisorAssignment', supervisorAssignmentSchema);
export default SupervisorAssignment;
