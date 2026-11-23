export const ROLES = Object.freeze({
  UNIVERSITY_ADMIN: 'universityAdmin',
  COLLEGE_ADMIN: 'collegeAdmin',
  DEPARTMENT_ADMIN: 'departmentAdmin',
  SUPERVISOR: 'supervisor',
  COMMITTEE_MEMBER: 'committeeMember',
  STUDENT: 'student',
  INVESTOR: 'investor',
  VISITOR: 'visitor',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ACCOUNT_TYPES = Object.freeze({
  STUDENT: 'student',
  STAFF: 'staff',
  INVESTOR: 'investor',
  VISITOR: 'visitor',
});

export const ACCOUNT_TYPE_VALUES = Object.freeze(Object.values(ACCOUNT_TYPES));

export const USER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  REJECTED: 'rejected',
  DEACTIVATED: 'deactivated',
});

export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUSES));

export const PRIVACY_VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  PUBLIC: 'public',
});

export const PRIVACY_VALUES = Object.freeze(Object.values(PRIVACY_VISIBILITY));

export const INVITATION_KINDS = Object.freeze({
  ROLE: 'role',
  TEAM: 'team',
  EXTERNAL_EXAMINER: 'external_examiner',
});

export const INVITATION_KIND_VALUES = Object.freeze(Object.values(INVITATION_KINDS));

export const TEAM_MEMBER_ROLES = Object.freeze({
  LEADER: 'leader',
  MEMBER: 'member',
});

export const SUPERVISION_KINDS = Object.freeze({
  PRIMARY: 'primary',
  CO: 'co',
  MENTOR: 'mentor',
  REVIEWER: 'reviewer',
});
