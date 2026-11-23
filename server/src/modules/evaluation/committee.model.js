import mongoose from 'mongoose';

const committeeSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', default: null },
    chairId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    memberIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    externalExaminerIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    allExaminerIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

committeeSchema.pre('validate', function syncAllExaminers(next) {
  const unique = new Set();
  if (this.chairId) unique.add(String(this.chairId));
  for (const id of this.memberIds || []) unique.add(String(id));
  for (const id of this.externalExaminerIds || []) unique.add(String(id));
  this.allExaminerIds = Array.from(unique).map((id) => new mongoose.Types.ObjectId(id));
  next();
});

committeeSchema.index({ projectId: 1 });
committeeSchema.index({ defenseId: 1 });
committeeSchema.index({ allExaminerIds: 1 });

const Committee = mongoose.models.Committee || mongoose.model('Committee', committeeSchema);
export default Committee;
