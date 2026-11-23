import mongoose from 'mongoose';
import { VOTE_STATUSES, VOTE_STATUS_VALUES } from '@spp/shared/constants';

const competitionVoteSchema = new mongoose.Schema(
  {
    competitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competition',
      required: true,
    },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: VOTE_STATUS_VALUES, default: VOTE_STATUSES.VALID },
    ipHash: { type: String, default: '' },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true }
);

competitionVoteSchema.index(
  { competitionId: 1, projectId: 1, userId: 1 },
  { unique: true }
);
competitionVoteSchema.index({ competitionId: 1, projectId: 1, createdAt: -1 });
competitionVoteSchema.index({ competitionId: 1, createdAt: -1 });

const CompetitionVote =
  mongoose.models.CompetitionVote ||
  mongoose.model('CompetitionVote', competitionVoteSchema);
export default CompetitionVote;
