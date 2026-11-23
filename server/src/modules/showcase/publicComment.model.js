import mongoose from 'mongoose';
import {
  MAX_PUBLIC_COMMENT_LENGTH,
  PUBLIC_COMMENT_STATE_VALUES,
  PUBLIC_COMMENT_STATES,
} from '@spp/shared/constants';

const reportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const publicCommentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: MAX_PUBLIC_COMMENT_LENGTH },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PublicComment', default: null },
    state: {
      type: String,
      enum: PUBLIC_COMMENT_STATE_VALUES,
      default: PUBLIC_COMMENT_STATES.VISIBLE,
    },
    reports: { type: [reportSchema], default: [] },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, trim: true, maxlength: 500 },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true }
);

publicCommentSchema.index({ projectId: 1, state: 1, createdAt: -1 });
publicCommentSchema.index({ 'reports.0': 1 });
publicCommentSchema.index({ authorId: 1, createdAt: -1 });

const PublicComment =
  mongoose.models.PublicComment || mongoose.model('PublicComment', publicCommentSchema);
export default PublicComment;
