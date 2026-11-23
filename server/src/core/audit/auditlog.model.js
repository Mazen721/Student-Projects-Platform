import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, trim: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: mongoose.Schema.Types.Mixed, default: null },
    scope: {
      collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
      departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
      projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, trim: true },
    ipHash: { type: String, trim: true },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

auditLogSchema.index({ 'scope.collegeId': 1, at: -1 });
auditLogSchema.index({ 'scope.departmentId': 1, at: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

function rejectMutation() {
  throw new Error('AuditLog records are append-only and immutable');
}

const IMMUTABLE_OPERATIONS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

for (const op of IMMUTABLE_OPERATIONS) {
  auditLogSchema.pre(op, rejectMutation);
}

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
