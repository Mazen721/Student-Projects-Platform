import {
  DEFENSE_STATES,
  DEFENSE_STATE_VALUES,
  MAX_DELIBERATION_ROUNDS,
  ROLES,
} from '../constants/index.js';
import { defineMachine } from './fsm.js';

const {
  NOT_ELIGIBLE,
  ELIGIBLE,
  SCHEDULED,
  GRADING,
  DELIBERATION,
  FINALIZED,
  REEVALUATION_REQUESTED,
  REEVALUATION_OPEN,
} = DEFENSE_STATES;

const ADMIN_ROLES = [ROLES.DEPARTMENT_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN];
const COLLEGE_OR_UNI_ADMIN = [ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN];

function hasNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function guardSignOff(ctx) {
  return ctx.allPhasesApproved ? null : 'NOT_ELIGIBLE_FOR_DEFENSE';
}

function guardCommitteeValid(ctx) {
  return ctx.validCommittee === false ? 'COI_VIOLATION' : null;
}

function guardScheduleCommittee(ctx) {
  return ctx.validCommittee ? null : 'COI_VIOLATION';
}

function guardUnlockForRevision(ctx) {
  if (!ctx.allSubmitted) return 'SCORES_INCOMPLETE';
  if (!ctx.spreadExceeded) return 'SPREAD_NOT_EXCEEDED';
  if (Number(ctx.deliberationCount || 0) >= MAX_DELIBERATION_ROUNDS) {
    return 'DELIBERATION_LIMIT_REACHED';
  }
  return null;
}

function guardFinalize(ctx) {
  if (!ctx.allSubmitted) return 'SCORES_INCOMPLETE';
  if (ctx.spreadExceeded && !hasNonEmptyText(ctx.note)) return 'VALIDATION_ERROR';
  return null;
}

function guardRequestReeval(ctx) {
  if (!ctx.windowOpen) return 'WINDOW_CLOSED';
  if (ctx.alreadyRequested) return 'REEVAL_ALREADY_REQUESTED';
  return null;
}

function guardRejectReeval(ctx) {
  return hasNonEmptyText(ctx.note) ? null : 'VALIDATION_ERROR';
}

export const defenseMachine = defineMachine({
  initial: NOT_ELIGIBLE,
  states: DEFENSE_STATE_VALUES,
  transitions: {
    SIGN_OFF: {
      from: [NOT_ELIGIBLE],
      to: ELIGIBLE,
      roles: ['primarySupervisor'],
      guard: guardSignOff,
    },
    REGRESS_ELIGIBILITY: {
      from: [ELIGIBLE],
      to: NOT_ELIGIBLE,
      roles: ['system'],
    },
    SCHEDULE: {
      from: [ELIGIBLE],
      to: SCHEDULED,
      roles: ADMIN_ROLES,
      guard: guardScheduleCommittee,
    },
    RESCHEDULE: {
      from: [SCHEDULED],
      to: SCHEDULED,
      roles: ADMIN_ROLES,
      guard: guardCommitteeValid,
    },
    OPEN_GRADING: {
      from: [SCHEDULED],
      to: GRADING,
      roles: ['committeeChair', ...ADMIN_ROLES],
    },
    UNLOCK_FOR_REVISION: {
      from: [GRADING],
      to: DELIBERATION,
      roles: ['committeeChair'],
      guard: guardUnlockForRevision,
    },
    RESUBMIT_SCORES: {
      from: [DELIBERATION],
      to: GRADING,
      roles: ['system', 'committeeExaminer'],
    },
    FINALIZE: {
      from: [GRADING, REEVALUATION_OPEN],
      to: FINALIZED,
      roles: ['committeeChair'],
      guard: guardFinalize,
    },
    REQUEST_REEVAL: {
      from: [FINALIZED],
      to: REEVALUATION_REQUESTED,
      roles: [ROLES.STUDENT, 'primarySupervisor'],
      guard: guardRequestReeval,
    },
    APPROVE_REEVAL: {
      from: [REEVALUATION_REQUESTED],
      to: REEVALUATION_OPEN,
      roles: COLLEGE_OR_UNI_ADMIN,
    },
    REJECT_REEVAL: {
      from: [REEVALUATION_REQUESTED],
      to: FINALIZED,
      roles: COLLEGE_OR_UNI_ADMIN,
      guard: guardRejectReeval,
    },
  },
});
