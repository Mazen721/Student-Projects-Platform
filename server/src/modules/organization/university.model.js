import mongoose from 'mongoose';
import {
  DEFAULT_MIN_VOTE_ACCOUNT_AGE_HOURS,
  DEFAULT_VOTE_BURST_PER_IP_10M,
} from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    logo: { type: fileRefSchema, default: undefined },
    settings: {
      allowedEmailDomains: {
        type: [{ type: String, trim: true, lowercase: true }],
        default: ['mnu.edu.eg'],
      },
      minVoteAccountAgeHours: {
        type: Number,
        default: DEFAULT_MIN_VOTE_ACCOUNT_AGE_HOURS,
        min: 0,
      },
      voteBurstPerIp10m: {
        type: Number,
        default: DEFAULT_VOTE_BURST_PER_IP_10M,
        min: 1,
      },
      featuredProjectIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
        default: [],
      },
    },
  },
  { timestamps: true }
);

const University =
  mongoose.models.University || mongoose.model('University', universitySchema);
export default University;
