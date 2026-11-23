export const SCOPE_TYPES = Object.freeze({
  UNIVERSITY: 'university',
  COLLEGE: 'college',
  DEPARTMENT: 'department',
  DEFENSE: 'defense',
  SELF: 'self',
});

export const SCOPE_TYPE_VALUES = Object.freeze(Object.values(SCOPE_TYPES));

export const AUTHZ_SCOPES = Object.freeze({
  UNIVERSITY: 'university',
  COLLEGE: 'college',
  DEPARTMENT: 'department',
  PROJECT: 'project',
  TEAM: 'team',
  DEFENSE: 'defense',
  PARTNER: 'partner',
  SELF: 'self',
});

export const SCOPE_HIERARCHY = Object.freeze([
  'university',
  'college',
  'department',
  'project',
  'self',
]);
