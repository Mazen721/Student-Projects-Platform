import mongoose from 'mongoose';

const examinerScoreSchema = new mongoose.Schema(
  {
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    examinerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    component: { type: String, enum: ['supervisor', 'committee'], required: true },
    version: { type: Number, required: true, min: 1 },
    revisionRound: { type: Number, default: 0, min: 0 },
    reevaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReEvaluationRequest',
      default: null,
    },
    teamScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    individualScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    totals: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedAt: { type: Date, default: null },
    supersededAt: { type: Date, default: null },
  },
  { timestamps: true }
);

examinerScoreSchema.index({ defenseId: 1, examinerId: 1, version: -1 });
examinerScoreSchema.index({ defenseId: 1, supersededAt: 1 });

const ExaminerScore =
  mongoose.models.ExaminerScore || mongoose.model('ExaminerScore', examinerScoreSchema);
export default ExaminerScore;
