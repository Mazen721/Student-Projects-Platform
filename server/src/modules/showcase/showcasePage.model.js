import mongoose from 'mongoose';
import {
  SHOWCASE_STATE_VALUES,
  SHOWCASE_STATES,
  SHOWCASE_TEMPLATE_VALUES,
  SHOWCASE_THEMES,
  SHOWCASE_THEME_VALUES,
} from '@spp/shared/constants';

const historySchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    event: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: '' },
    reason: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const showcasePageSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
    },
    slug: { type: String, required: true, trim: true },
    state: {
      type: String,
      enum: SHOWCASE_STATE_VALUES,
      default: SHOWCASE_STATES.DRAFT,
    },
    everApproved: { type: Boolean, default: false },
    template: {
      type: String,
      enum: SHOWCASE_TEMPLATE_VALUES,
      default: 'classic',
    },
    theme: {
      type: String,
      enum: SHOWCASE_THEME_VALUES,
      default: SHOWCASE_THEMES.NAVY_GOLD,
    },
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
    hiddenSections: { type: [String], default: [] },
    takedown: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, trim: true, maxlength: 1000 },
      at: { type: Date },
    },
    history: { type: [historySchema], default: [] },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  },
  { timestamps: true }
);

showcasePageSchema.index({ state: 1, collegeId: 1 });
showcasePageSchema.index({ state: 1, 'showcaseStats.trendingScore': -1 });

const ShowcasePage =
  mongoose.models.ShowcasePage || mongoose.model('ShowcasePage', showcasePageSchema);
export default ShowcasePage;
