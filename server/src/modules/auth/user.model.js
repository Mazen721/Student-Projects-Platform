import mongoose from 'mongoose';
import {
  ACCOUNT_TYPE_VALUES,
  MAX_BIO_LENGTH,
  MAX_SKILLS,
  PRIVACY_VALUES,
  PRIVACY_VISIBILITY,
  ROLE_VALUES,
  SCOPE_TYPE_VALUES,
  USER_STATUSES,
  USER_STATUS_VALUES,
} from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const roleAssignmentSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ROLE_VALUES, required: true },
    scopeType: { type: String, enum: SCOPE_TYPE_VALUES, required: true },
    scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    defenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Defense', default: null },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    grantedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    emailReleased: { type: Boolean, default: false },
    studentId: { type: String, trim: true, maxlength: 32 },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    status: { type: String, enum: USER_STATUS_VALUES, default: USER_STATUSES.ACTIVE },
    accountType: { type: String, enum: ACCOUNT_TYPE_VALUES, required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    profile: {
      avatar: { type: fileRefSchema, default: undefined },
      bio: { type: String, trim: true, maxlength: MAX_BIO_LENGTH },
      skills: {
        type: [{ type: String, trim: true, maxlength: 50 }],
        validate: [(arr) => arr.length <= MAX_SKILLS, 'Exceeds max skills'],
        default: [],
      },
      phone: { type: String, trim: true, maxlength: 30 },
      socialLinks: {
        type: [{ type: String, trim: true }],
        default: [],
      },
    },
    privacy: {
      email: { type: String, enum: PRIVACY_VALUES, default: PRIVACY_VISIBILITY.PRIVATE },
      phone: { type: String, enum: PRIVACY_VALUES, default: PRIVACY_VISIBILITY.PRIVATE },
      socialLinks: { type: String, enum: PRIVACY_VALUES, default: PRIVACY_VISIBILITY.PRIVATE },
    },
    investor: {
      organization: { type: String, trim: true, maxlength: 150 },
      fieldOfInterest: { type: String, trim: true, maxlength: 150 },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      rejectionReason: { type: String, trim: true, maxlength: 500 },
    },
    roles: { type: [roleAssignmentSchema], default: [] },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { emailReleased: false } }
);
userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { studentId: { $type: 'string' }, emailReleased: false },
  }
);
userSchema.index({ 'roles.role': 1, 'roles.collegeId': 1 });
userSchema.index({ 'roles.role': 1, 'roles.departmentId': 1 });
userSchema.index({ collegeId: 1, departmentId: 1, status: 1 });
userSchema.index({ status: 1, accountType: 1, createdAt: -1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
