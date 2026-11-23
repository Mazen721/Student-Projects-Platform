import mongoose from 'mongoose';
import { ROLES, USER_STATUSES } from '@spp/shared/constants';
import User from './user.model.js';

const BASIC_USER_SELECT = '_id name email studentId status accountType collegeId departmentId roles profile.avatar';

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
