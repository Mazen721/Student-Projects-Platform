import mongoose from 'mongoose';
import {
  DEFENSE_STATES,
  DEFENSE_STATE_VALUES,
  PROJECT_FIELD_VALUES,
  PROJECT_TYPE_VALUES,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_VALUES,
  STATUS_FLAGS,
  STATUS_FLAG_VALUES,
  TEAM_MEMBER_ROLES,
} from '@spp/shared/constants';
import { normalizeArabic } from '@spp/shared/text';

const fileRefSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    deliveryType: { type: String, enum: ['upload', 'authenticated'], required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    originalName: { type: String },
  },
  { _id: false }
);

const statusChangeSchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    event: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    comment: { type: String, maxlength: 1500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.values(TEAM_MEMBER_ROLES), required: true },
    status: { type: String, enum: ['active', 'left', 'removed'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    titleNormalized: { type: String, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    idea: { type: String, required: true, trim: true, maxlength: 3000 },
    problem: { type: String, required: true, trim: true, maxlength: 3000 },
    objectives: { type: [String], default: [] },
    scope: { type: String, required: true, trim: true, maxlength: 2000 },
    field: { type: String, enum: PROJECT_FIELD_VALUES, required: true },
    type: { type: String, enum: PROJECT_TYPE_VALUES, required: true },
    beneficiaries: { type: String, required: true, trim: true, maxlength: 500 },
    keywords: { type: [String], default: [] },
    expectedOutcomes: { type: String, required: true, trim: true, maxlength: 2000 },
    cover: { type: fileRefSchema, default: null },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    academicYearLabel: { type: String, required: true, trim: true },
    partnerCollegeIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    partnerDepartmentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: PROPOSAL_STATUS_VALUES, default: PROPOSAL_STATUSES.DRAFT },
    history: { type: [statusChangeSchema], default: [] },
    team: {
      leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      members: { type: [teamMemberSchema], default: [] },
    },
    activeMemberIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    preferredSupervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supervision: {
      primaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      coSupervisorIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      mentorIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    supervisorIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', default: null },
    progress: {
      percent: { type: Number, default: 0, min: 0, max: 100 },
      perPhase: {
        type: [
          {
            phaseId: { type: mongoose.Schema.Types.ObjectId },
            percent: { type: Number, default: 0 },
          },
        ],
        default: [],
      },
      computedAt: { type: Date },
    },
    statusFlag: { type: String, enum: STATUS_FLAG_VALUES, default: STATUS_FLAGS.ON_TRACK },
    defenseState: { type: String, enum: DEFENSE_STATE_VALUES, default: DEFENSE_STATES.NOT_ELIGIBLE },
    supervisorSignOff: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    budgetEstimate: { type: Number, default: 0, min: 0 },
    showcaseStats: {
      validVotes: { type: Number, default: 0 },
      votes7d: { type: Number, default: 0 },
      views7d: { type: Number, default: 0 },
      trendingScore: { type: Number, default: 0 },
      follows: { type: Number, default: 0 },
      bookmarks: { type: Number, default: 0 },
    },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

projectSchema.pre('validate', function syncProjectDerivedFields(next) {
  if (this.title) {
    this.titleNormalized = normalizeArabic(this.title);
  }
  const supSet = new Set();
  if (this.supervision?.primaryId) supSet.add(String(this.supervision.primaryId));
  if (this.supervision?.reviewerId) supSet.add(String(this.supervision.reviewerId));
  for (const id of this.supervision?.coSupervisorIds || []) supSet.add(String(id));
  for (const id of this.supervision?.mentorIds || []) supSet.add(String(id));
  this.supervisorIds = Array.from(supSet).map((id) => new mongoose.Types.ObjectId(id));
  next();
});

projectSchema.index({ collegeId: 1, academicYearId: 1, status: 1 });
projectSchema.index({ academicYearLabel: 1, status: 1 });
projectSchema.index({ departmentId: 1, academicYearId: 1, status: 1 });
projectSchema.index({ supervisorIds: 1, academicYearId: 1 });
projectSchema.index({ 'supervision.primaryId': 1, academicYearId: 1, status: 1 });
projectSchema.index({ activeMemberIds: 1, academicYearId: 1 });
projectSchema.index({ field: 1, academicYearId: 1 });
projectSchema.index({ isPublished: 1, 'showcaseStats.trendingScore': -1 });
projectSchema.index({ isPublished: 1, 'showcaseStats.validVotes': -1 });
projectSchema.index({ partnerCollegeIds: 1 });
projectSchema.index(
  { titleNormalized: 'text', keywords: 'text' },
  { default_language: 'none', name: 'projects_text_search' }
);

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
export default Project;
