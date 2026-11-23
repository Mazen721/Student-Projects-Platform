import mongoose from 'mongoose';
import {
  DEFENSE_STATES,
  DEFENSE_STATE_VALUES,
  MODIFICATION_STATES,
  MODIFICATION_STATE_VALUES,
} from '@spp/shared/constants';

const defenseHistorySchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    event: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    note: { type: String, maxlength: 1500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const defenseSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    rubricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rubric', required: true },
    state: { type: String, enum: DEFENSE_STATE_VALUES, default: DEFENSE_STATES.SCHEDULED },
    scheduledAt: { type: Date, required: true },
    durationMin: { type: Number, default: 60, min: 15, max: 240 },
    room: { type: String, trim: true, maxlength: 100 },
    meetingLink: { type: String, trim: true },
    committeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee', required: true },
    chairId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    examinerIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    supervisorIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    eligibleMemberIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    revisionRound: { type: Number, default: 0, min: 0 },
    minutes: { type: String, trim: true, maxlength: 5000 },
    recommendations: { type: String, trim: true, maxlength: 3000 },
    modifications: {
      required: { type: Boolean, default: false },
      description: { type: String, trim: true, maxlength: 2000 },
      deadline: { type: Date },
      state: {
        type: String,
        enum: MODIFICATION_STATE_VALUES,
        default: MODIFICATION_STATES.NONE,
      },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      confirmedAt: { type: Date },
    },
    spreadFlag: {
      exceeded: { type: Boolean, default: false },
      maxSpread: { type: Number, default: 0 },
      deliberationCount: { type: Number, default: 0 },
      note: { type: String, trim: true, maxlength: 1500 },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    activeReevaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReEvaluationRequest',
      default: null,
    },
    history: { type: [defenseHistorySchema], default: [] },
  },
  { timestamps: true }
);

defenseSchema.index({ collegeId: 1, scheduledAt: 1 });
defenseSchema.index({ room: 1, scheduledAt: 1 });
defenseSchema.index({ examinerIds: 1, scheduledAt: 1 });
defenseSchema.index({ state: 1, 'modifications.state': 1, 'modifications.deadline': 1 });

const Defense = mongoose.models.Defense || mongoose.model('Defense', defenseSchema);
export default Defense;
