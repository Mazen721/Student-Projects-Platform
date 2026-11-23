import mongoose from 'mongoose';
import { CHANNEL_KIND_VALUES } from '@spp/shared/constants';

const channelMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: null },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    kind: { type: String, enum: CHANNEL_KIND_VALUES, required: true },
    memberIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    members: { type: [channelMemberSchema], default: [] },
    title: { type: String, trim: true, maxlength: 200 },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', default: null },
  },
  { timestamps: true }
);

channelSchema.index({ projectId: 1, kind: 1 });
channelSchema.index({ memberIds: 1, updatedAt: -1 });

const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
export default Channel;
