import { PROPOSAL_STATUSES, PROPOSAL_STATUS_VALUES, ROLES } from '../constants/index.js';
import { defineMachine } from './fsm.js';

const {
  DRAFT,
  SUBMITTED,
  UNDER_REVIEW,
  NEEDS_CHANGES,
  SUPERVISOR_RECOMMENDED,
  APPROVED,
  REJECTED,
  WITHDRAWN,
  ARCHIVED,
} = PROPOSAL_STATUSES;

const ADMIN_ROLES = [ROLES.DEPARTMENT_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN];
const REVIEW_ROLES = [ROLES.SUPERVISOR, ...ADMIN_ROLES];

function hasComment(ctx) {
  return typeof ctx.comment === 'string' && ctx.comment.trim().length > 0;
}

function guardActiveLeader(ctx) {
  if (ctx.leaderDeactivated) return 'FORBIDDEN';
  return null;
}

function guardSubmit(ctx) {
  if (ctx.leaderDeactivated) return 'FORBIDDEN';
  if (!ctx.windowOpen) return 'WINDOW_CLOSED';
  if (Number(ctx.teamCount || 0) < Number(ctx.teamSizeMin || 1)) return 'TEAM_BELOW_MIN';
  return null;
}

function guardResubmit(ctx) {
  if (ctx.leaderDeactivated) return 'FORBIDDEN';
  if (!ctx.resubmitOpen) return 'WINDOW_CLOSED';
  if (Number(ctx.teamCount || 0) < Number(ctx.teamSizeMin || 1)) return 'TEAM_BELOW_MIN';
  return null;
}

function guardCommentRequired(ctx) {
  return hasComment(ctx) ? null : 'VALIDATION_ERROR';
}

export const proposalMachine = defineMachine({
  initial: DRAFT,
  states: PROPOSAL_STATUS_VALUES,
  transitions: {
    SUBMIT: {
      from: [DRAFT],
      to: SUBMITTED,
      roles: ['leader'],
      guard: guardSubmit,
    },
    START_REVIEW: {
      from: [SUBMITTED],
      to: UNDER_REVIEW,
      roles: REVIEW_ROLES,
    },
    REQUEST_CHANGES: {
      from: [UNDER_REVIEW],
      to: NEEDS_CHANGES,
      roles: [ROLES.SUPERVISOR],
      guard: guardCommentRequired,
    },
    RESUBMIT: {
      from: [NEEDS_CHANGES],
      to: SUBMITTED,
      roles: ['leader'],
      guard: guardResubmit,
    },
    RECOMMEND: {
      from: [UNDER_REVIEW],
      to: SUPERVISOR_RECOMMENDED,
      roles: [ROLES.SUPERVISOR],
      guard: guardCommentRequired,
    },
    APPROVE: {
      from: [SUPERVISOR_RECOMMENDED],
      to: APPROVED,
      roles: ADMIN_ROLES,
    },
    REJECT: {
      from: [SUPERVISOR_RECOMMENDED],
      to: REJECTED,
      roles: ADMIN_ROLES,
      guard: guardCommentRequired,
    },
    RETURN: {
      from: [SUPERVISOR_RECOMMENDED],
      to: NEEDS_CHANGES,
      roles: ADMIN_ROLES,
    },
    WITHDRAW: {
      from: [DRAFT, SUBMITTED, NEEDS_CHANGES],
      to: WITHDRAWN,
      roles: ['leader'],
      guard: guardActiveLeader,
    },
    YEAR_ROLLOVER: {
      from: [APPROVED],
      to: ARCHIVED,
      roles: ['system'],
    },
  },
});
