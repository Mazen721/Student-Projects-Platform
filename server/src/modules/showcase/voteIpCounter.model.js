import mongoose from 'mongoose';

const VOTE_IP_COUNTER_TTL_SECONDS = 60 * 60;

const voteIpCounterSchema = new mongoose.Schema(
  {
    ipHash: { type: String, required: true },
    window: { type: Date, required: true },
    count: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: VOTE_IP_COUNTER_TTL_SECONDS },
  },
  { timestamps: false }
);

voteIpCounterSchema.index({ ipHash: 1, window: 1 }, { unique: true });

const VoteIpCounter =
  mongoose.models.VoteIpCounter || mongoose.model('VoteIpCounter', voteIpCounterSchema);
export default VoteIpCounter;
