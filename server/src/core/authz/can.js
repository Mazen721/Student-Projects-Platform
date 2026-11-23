import { AUTHZ_SCOPES, ROLES, USER_STATUSES } from '@spp/shared/constants';
import { POLICIES } from './policies.js';

function toIdString(value) {
  if (!value) return null;
  return String(value._id ?? value);
}

function includesId(list, targetId) {
  if (!Array.isArray(list) || !targetId) return false;
  const normalizedTarget = String(targetId);
  return list.some((entry) => String(entry?._id ?? entry) === normalizedTarget);
}

function isSupervisorOfScope(userId, scope) {
  return (
    toIdString(scope.supervisorId) === userId ||
    toIdString(scope.reviewerId) === userId ||
    includesId(scope.coSupervisorIds, userId) ||
    includesId(scope.mentorIds, userId)
  );
}

function matchesRelationship(userId, relationship, scope) {
  switch (relationship) {
    case 'leader':
      return toIdString(scope.leaderId) === userId;
    case 'teamMember':
      return includesId(scope.activeMemberIds, userId);
    case 'primarySupervisor':
      return toIdString(scope.supervisorId) === userId;
    case 'anySupervisor':
      return isSupervisorOfScope(userId, scope);
    case 'channelMember': {
      if (!includesId(scope.channelMemberIds, userId)) return false;
      if (scope.kind === 'team_only') {
        return includesId(scope.activeMemberIds, userId) && !isSupervisorOfScope(userId, scope);
      }
      return true;
    }
    case 'committeeChair':
      return toIdString(scope.chairId) === userId;
    case 'committeeExaminer':
      return includesId(scope.examinerIds, userId);
    case 'owner':
      return toIdString(scope.ownerId) === userId;
    case 'invitee':
      return toIdString(scope.inviteeId) === userId;
    case 'transferTarget':
      return toIdString(scope.toUserId) === userId;
    case 'selfGradeStudent':
      return toIdString(scope.studentId) === userId;
    default:
      return false;
  }
}

function assignmentMatchesScope(assignment, requiredScope, scope, userId) {
  if (assignment.role === ROLES.UNIVERSITY_ADMIN) {
    return true;
  }

  const targetCollegeId = toIdString(scope.collegeId);
  const targetDepartmentId = toIdString(scope.departmentId);
  const assignCollegeId = toIdString(assignment.collegeId ?? assignment.scopeId);
  const assignDeptId = toIdString(assignment.departmentId ?? assignment.scopeId);

  switch (requiredScope) {
    case AUTHZ_SCOPES.UNIVERSITY:
      return false;
    case AUTHZ_SCOPES.COLLEGE:
      if ('collegeId' in scope) {
        return Boolean(targetCollegeId && assignCollegeId === targetCollegeId);
      }
      return Boolean(assignCollegeId);
    case AUTHZ_SCOPES.DEPARTMENT:
      if (assignment.role === ROLES.COLLEGE_ADMIN) {
        if ('collegeId' in scope) {
          return Boolean(targetCollegeId && assignCollegeId === targetCollegeId);
        }
        return Boolean(assignCollegeId);
      }
      if (assignment.role === ROLES.DEPARTMENT_ADMIN) {
        if ('departmentId' in scope) {
          return Boolean(targetDepartmentId && assignDeptId === targetDepartmentId);
        }
        return Boolean(assignDeptId);
      }
      return Boolean(targetCollegeId ? assignCollegeId === targetCollegeId : true);
    case AUTHZ_SCOPES.DEFENSE:
      if (assignment.role === ROLES.COMMITTEE_MEMBER) {
        const targetDefenseId = toIdString(scope.defenseId);
        return Boolean(
          targetDefenseId &&
            toIdString(assignment.defenseId ?? assignment.scopeId) === targetDefenseId &&
            scope.defenseState !== 'finalized'
        );
      }
      return assignmentMatchesScope(assignment, AUTHZ_SCOPES.DEPARTMENT, scope, userId);
    case AUTHZ_SCOPES.PARTNER:
      if (assignment.role === ROLES.COLLEGE_ADMIN) {
        return includesId(scope.partnerCollegeIds, assignCollegeId);
      }
      if (assignment.role === ROLES.DEPARTMENT_ADMIN) {
        return includesId(scope.partnerDepartmentIds, assignDeptId);
      }
      return false;
    case AUTHZ_SCOPES.SELF:
      if (scope.userId && toIdString(scope.userId) !== userId) {
        return false;
      }
      return true;
    default:
      return false;
  }
}

function matchesRule(user, userId, rule, scope) {
  if (rule.relationship) {
    return matchesRelationship(userId, rule.relationship, scope);
  }
  const assignments = Array.isArray(user.roles) ? user.roles : [];
  return assignments.some((assignment) => {
    if (!rule.roles.includes(assignment.role)) return false;
    if (rule.anyScope) return true;
    if (!scope || Object.keys(scope).length === 0) {
      return rule.scope !== AUTHZ_SCOPES.UNIVERSITY || assignment.role === ROLES.UNIVERSITY_ADMIN;
    }
    return assignmentMatchesScope(assignment, rule.scope, scope, userId);
  });
}

export function can(user, action, scope = {}) {
  if (!user) return false;
  const rules = POLICIES[action];
  if (!rules) return false;

  const userId = toIdString(user._id ?? user.id);
  if (!userId) return false;

  const isActive = user.status === USER_STATUSES.ACTIVE;
  const isPending = user.status === USER_STATUSES.PENDING;

  return rules.some((rule) => {
    if (!isActive && !(isPending && rule.allowPending)) {
      return false;
    }
    return matchesRule(user, userId, rule, scope);
  });
}
