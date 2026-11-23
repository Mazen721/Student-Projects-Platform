import mongoose from 'mongoose';

export const STATS_CACHE_KINDS = Object.freeze([
  'completion',
  'supervisor_load',
  'late_rate',
  'evaluation',
  'insights',
]);

export const STATS_CACHE_SCOPE_TYPES = Object.freeze(['university', 'college', 'department']);

const statsCacheSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: STATS_CACHE_KINDS, required: true },
    yearKey: { type: String, required: true, trim: true },
    scopeType: { type: String, enum: STATS_CACHE_SCOPE_TYPES, required: true },
    scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    computedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: false, versionKey: false }
);

statsCacheSchema.index({ kind: 1, yearKey: 1, scopeType: 1, scopeId: 1 }, { unique: true });

const StatsCache = mongoose.models.StatsCache || mongoose.model('StatsCache', statsCacheSchema);
export default StatsCache;
