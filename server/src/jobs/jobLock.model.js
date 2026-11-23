import mongoose from 'mongoose';

const jobLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
    lockedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const JobLock = mongoose.models.JobLock || mongoose.model('JobLock', jobLockSchema);
export default JobLock;
