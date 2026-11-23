import mongoose from 'mongoose';
import { ROLES, USER_STATUSES } from '@spp/shared/constants';
import User from './user.model.js';

const BASIC_USER_SELECT = '_id name email studentId status accountType collegeId departmentId roles profile.avatar createdAt';

function toBasicUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    studentId: doc.studentId || null,
    status: doc.status,
    accountType: doc.accountType,
    collegeId: doc.collegeId,
    departmentId: doc.departmentId,
    roles: doc.roles || [],
    avatar: doc.profile?.avatar || null,
    createdAt: doc.createdAt || null,
  };
}

export async function findUsersBasicByIds(userIds = [], session = null) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();

  const docs = await User.find({ _id: mongoose.trusted({ $in: uniqueIds }) })
    .select(BASIC_USER_SELECT)
    .session(session || null)
    .lean();

  return new Map(docs.map((doc) => [String(doc._id), toBasicUser(doc)]));
}

export async function findUserBasicById(userId, session = null) {
  if (!userId) return null;
  const doc = await User.findById(userId)
    .select(BASIC_USER_SELECT)
    .session(session || null)
    .lean();
  return toBasicUser(doc);
}

export async function listSupervisorsInScope(scopeFilter = {}, query = {}) {
  const filter = {
    status: USER_STATUSES.ACTIVE,
    'roles.role': ROLES.SUPERVISOR,
  };
  if (scopeFilter.collegeId) filter.collegeId = scopeFilter.collegeId;
  if (scopeFilter.departmentId) filter.departmentId = scopeFilter.departmentId;
  if (query.collegeId) filter.collegeId = query.collegeId;
  if (query.departmentId) filter.departmentId = query.departmentId;

  const docs = await User.find(filter)
    .select('_id name collegeId departmentId')
    .sort({ name: 1 })
    .lean();

  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    collegeId: d.collegeId,
    departmentId: d.departmentId,
  }));
}

export async function listActiveStaffAndStudentIdsInScope({ collegeId, departmentId } = {}) {
  const filter = {
    status: USER_STATUSES.ACTIVE,
    accountType: mongoose.trusted({ $in: ['student', 'staff'] }),
  };
  if (collegeId) filter.collegeId = collegeId;
  if (departmentId) filter.departmentId = departmentId;
  const docs = await User.find(filter).select('_id').lean();
  return docs.map((d) => String(d._id));
}

export async function listCollegeAdminIds(collegeId) {
  if (!collegeId) return [];
  const docs = await User.find({
    status: USER_STATUSES.ACTIVE,
    roles: {
      $elemMatch: {
        role: ROLES.COLLEGE_ADMIN,
        collegeId,
      },
    },
  })
    .select('_id')
    .lean();
  return docs.map((d) => String(d._id));
}

export async function listActiveExaminersInCollege(collegeId) {
  if (!collegeId) return [];
  const docs = await User.find({
    status: USER_STATUSES.ACTIVE,
    collegeId,
    'roles.role': mongoose.trusted({ $in: [ROLES.COMMITTEE_MEMBER, ROLES.SUPERVISOR] }),
  })
    .select('_id name')
    .sort({ name: 1 })
    .lean();
  return docs.map((d) => ({ id: String(d._id), name: d.name }));
}

export async function findShowcaseTeamUsersByIds(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();

  const docs = await User.find({
    _id: mongoose.trusted({ $in: uniqueIds }),
    status: USER_STATUSES.ACTIVE,
    emailReleased: false,
  })
    .select('_id name email profile.avatar profile.phone profile.socialLinks privacy')
    .lean();

  return new Map(
    docs.map((doc) => [
      String(doc._id),
      {
        id: String(doc._id),
        name: doc.name,
        email: doc.email || null,
        avatar: doc.profile?.avatar || null,
        phone: doc.profile?.phone || null,
        socialLinks: doc.profile?.socialLinks || null,
        privacy: doc.privacy || {},
      },
    ])
  );
}
