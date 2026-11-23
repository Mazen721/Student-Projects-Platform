import mongoose from 'mongoose';
import { ROLES } from '@spp/shared/constants';
import { AppError } from '../errors/AppError.js';

function toIdString(value) {
  if (!value) return null;
  return String(value._id ?? value);
}

export function resolveRoleContext(user, roleContextId) {
  if (!roleContextId) return user;
  const assignments = Array.isArray(user?.roles) ? user.roles : [];
  const matched = assignments.find((assignment) => String(assignment._id) === String(roleContextId));
  if (!matched) {
    throw AppError.forbidden();
  }
  return { ...user, roles: [matched] };
}

function getEffectiveAssignment(user) {
  const assignments = Array.isArray(user?.roles) ? user.roles : [];
  const priority = [
    ROLES.UNIVERSITY_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.DEPARTMENT_ADMIN,
    ROLES.SUPERVISOR,
    ROLES.COMMITTEE_MEMBER,
    ROLES.STUDENT,
    ROLES.INVESTOR,
    ROLES.VISITOR,
  ];
  for (const roleName of priority) {
    const found = assignments.find((a) => a.role === roleName);
    if (found) return found;
  }
  return null;
}

function filterForProjects(assignments, userId) {
  const clauses = [];
  for (const assignment of assignments) {
    if (assignment.role === ROLES.UNIVERSITY_ADMIN) return {};
    if (assignment.role === ROLES.COLLEGE_ADMIN && (assignment.collegeId || assignment.scopeId)) {
      const collegeId = toIdString(assignment.collegeId ?? assignment.scopeId);
      clauses.push({ collegeId }, { partnerCollegeIds: collegeId });
    } else if (assignment.role === ROLES.DEPARTMENT_ADMIN && (assignment.departmentId || assignment.scopeId)) {
      const departmentId = toIdString(assignment.departmentId ?? assignment.scopeId);
      clauses.push({ departmentId }, { partnerDepartmentIds: departmentId });
    } else if (assignment.role === ROLES.SUPERVISOR) {
      clauses.push({ supervisorIds: userId });
    } else if (assignment.role === ROLES.STUDENT) {
      clauses.push({ activeMemberIds: userId });
    }
  }
  if (clauses.length === 0) return { _id: null };
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function filterForAuditLogs(assignments) {
  const clauses = [];
  for (const assignment of assignments) {
    if (assignment.role === ROLES.UNIVERSITY_ADMIN) return {};
    if (assignment.role === ROLES.COLLEGE_ADMIN && (assignment.collegeId || assignment.scopeId)) {
      clauses.push({ 'scope.collegeId': toIdString(assignment.collegeId ?? assignment.scopeId) });
    } else if (assignment.role === ROLES.DEPARTMENT_ADMIN && (assignment.departmentId || assignment.scopeId)) {
      clauses.push({ 'scope.departmentId': toIdString(assignment.departmentId ?? assignment.scopeId) });
    }
  }
  if (clauses.length === 0) return { _id: null };
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function filterForColleges(assignments) {
  const collegeIds = [];
  for (const assignment of assignments) {
    if (assignment.role === ROLES.UNIVERSITY_ADMIN) return {};
    const collegeId = toIdString(assignment.collegeId ?? assignment.scopeId);
    if (collegeId) collegeIds.push(collegeId);
  }
  if (collegeIds.length === 0) return { _id: null };
  return collegeIds.length === 1 ? { _id: collegeIds[0] } : { _id: mongoose.trusted({ $in: collegeIds }) };
}

function filterByCollegeOrDepartment(assignments) {
  const clauses = [];
  for (const assignment of assignments) {
    if (assignment.role === ROLES.UNIVERSITY_ADMIN) return {};
    if (assignment.role === ROLES.COLLEGE_ADMIN && (assignment.collegeId || assignment.scopeId)) {
      clauses.push({ collegeId: toIdString(assignment.collegeId ?? assignment.scopeId) });
    } else if (assignment.role === ROLES.DEPARTMENT_ADMIN && (assignment.departmentId || assignment.scopeId)) {
      clauses.push({ departmentId: toIdString(assignment.departmentId ?? assignment.scopeId) });
    }
  }
  if (clauses.length === 0) return { _id: null };
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

export function buildScopeFilter(user, action) {
  const userId = toIdString(user?._id ?? user?.id);
  const assignments = Array.isArray(user?.roles) ? user.roles : [];
  if (!userId || assignments.length === 0) return { _id: null };

  if (action.startsWith('project.')) {
    return filterForProjects(assignments, userId);
  }
  if (action === 'idea.list') {
    const primary = getEffectiveAssignment(user);
    if (!primary || primary.role === ROLES.UNIVERSITY_ADMIN || primary.role === ROLES.INVESTOR) {
      return {};
    }
    const collegeId = toIdString(primary.collegeId ?? primary.scopeId);
    return collegeId ? { $or: [{ collegeId }, { collegeId: null }] } : {};
  }
  if (action === 'audit.list') {
    return filterForAuditLogs(assignments);
  }
  if (action === 'college.list') {
    return filterForColleges(assignments);
  }
  if (
    action === 'supervision.viewLoad' ||
    action.startsWith('user.') ||
    action.startsWith('report.') ||
    action.startsWith('defense.') ||
    action.startsWith('reeval.') ||
    action.startsWith('vote.')
  ) {
    return filterByCollegeOrDepartment(assignments);
  }

  const primary = getEffectiveAssignment(user);
  if (!primary || primary.role === ROLES.UNIVERSITY_ADMIN) return {};
  if (primary.collegeId) return { collegeId: toIdString(primary.collegeId) };
  return {};
}
