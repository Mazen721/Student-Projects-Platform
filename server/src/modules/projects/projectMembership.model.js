import mongoose from 'mongoose';

const projectMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

projectMembershipSchema.index(
  { userId: 1, academicYearId: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
projectMembershipSchema.index({ projectId: 1, active: 1 });

const ProjectMembership =
  mongoose.models.ProjectMembership || mongoose.model('ProjectMembership', projectMembershipSchema);
export default ProjectMembership;
