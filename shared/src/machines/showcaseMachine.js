import { ROLES, SHOWCASE_STATES, SHOWCASE_STATE_VALUES } from '../constants/index.js';
import { defineMachine } from './fsm.js';

const ADMIN_ROLES = [ROLES.SUPERVISOR, ROLES.DEPARTMENT_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN];
const APPROVER_ROLES = [ROLES.SUPERVISOR, ROLES.DEPARTMENT_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN];

function hasReason(ctx) {
  return typeof ctx.reason === 'string' && ctx.reason.trim().length > 0;
}

function guardApprovedProject(ctx) {
  return ctx.projectApproved ? null : 'PROJECT_NOT_APPROVED';
}

function guardReasonRequired(ctx) {
  return hasReason(ctx) ? null : 'VALIDATION_ERROR';
}

function guardEverApproved(ctx) {
  return ctx.everApproved ? null : 'PUBLISH_REQUIRES_APPROVAL';
}

export const showcaseMachine = defineMachine({
  initial: SHOWCASE_STATES.DRAFT,
  states: SHOWCASE_STATE_VALUES,
  transitions: {
    REQUEST_PUBLISH: {
      from: [SHOWCASE_STATES.DRAFT, SHOWCASE_STATES.TAKEN_DOWN, SHOWCASE_STATES.UNPUBLISHED],
      to: SHOWCASE_STATES.PENDING_APPROVAL,
      roles: ['teamMember'],
      guard: guardApprovedProject,
    },
    APPROVE: {
      from: [SHOWCASE_STATES.PENDING_APPROVAL],
      to: SHOWCASE_STATES.PUBLISHED,
      roles: APPROVER_ROLES,
      guard: guardApprovedProject,
    },
    REJECT_PUBLISH: {
      from: [SHOWCASE_STATES.PENDING_APPROVAL],
      to: SHOWCASE_STATES.DRAFT,
      roles: APPROVER_ROLES,
      guard: guardReasonRequired,
    },
    UNPUBLISH: {
      from: [SHOWCASE_STATES.PUBLISHED],
      to: SHOWCASE_STATES.UNPUBLISHED,
      roles: ['teamMember', ROLES.SUPERVISOR, ...ADMIN_ROLES.slice(1)],
    },
    PUBLISH: {
      from: [SHOWCASE_STATES.UNPUBLISHED],
      to: SHOWCASE_STATES.PUBLISHED,
      roles: ['teamMember'],
      guard: guardEverApproved,
    },
    TAKE_DOWN: {
      from: [SHOWCASE_STATES.PUBLISHED, SHOWCASE_STATES.UNPUBLISHED],
      to: SHOWCASE_STATES.TAKEN_DOWN,
      roles: [ROLES.SUPERVISOR, ...ADMIN_ROLES.slice(1)],
      guard: guardReasonRequired,
    },
    AUTO_TAKE_DOWN: {
      from: [
        SHOWCASE_STATES.PENDING_APPROVAL,
        SHOWCASE_STATES.PUBLISHED,
        SHOWCASE_STATES.UNPUBLISHED,
      ],
      to: SHOWCASE_STATES.TAKEN_DOWN,
      roles: ['system'],
    },
  },
});
