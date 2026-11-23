import mongoose from 'mongoose';
import {
  COMPETITION_STATE_VALUES,
  COMPETITION_STATES,
  VOTER_RESTRICTION_VALUES,
  VOTER_RESTRICTIONS,
} from '@spp/shared/constants';

const frozenRankingSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    votes: { type: Number, default: 0 },
    rank: { type: Number, required: true },
  },
  { _id: false }
);

const competitionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    scopeType: { type: String, enum: ['university', 'college'], required: true },
    scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    eligibleProjectIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
      default: [],
    },
    voterRestriction: {
      type: String,
      enum: VOTER_RESTRICTION_VALUES,
      default: VOTER_RESTRICTIONS.ALL,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    state: {
      type: String,
      enum: COMPETITION_STATE_VALUES,
      default: COMPETITION_STATES.SCHEDULED,
    },
    frozenRanking: { type: [frozenRankingSchema], default: [] },
    frozenAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

competitionSchema.index({ state: 1, endsAt: 1 });
competitionSchema.index({ collegeId: 1, startsAt: -1 });

const Competition =
  mongoose.models.Competition || mongoose.model('Competition', competitionSchema);
export default Competition;
