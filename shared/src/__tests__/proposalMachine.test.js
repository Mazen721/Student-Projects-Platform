import { describe, expect, it } from 'vitest';
import { PROPOSAL_STATUSES, ROLES } from '../constants/index.js';
import { proposalMachine } from '../machines/proposalMachine.js';
import { isProposalResubmitOpen, isRegistrationOpen } from '../calc/windows.js';

describe('proposalMachine & cycle windows', () => {
  it('starts in draft and follows the two-step approval lifecycle', () => {
    expect(proposalMachine.initial).toBe(PROPOSAL_STATUSES.DRAFT);

    const s1 = proposalMachine.next(PROPOSAL_STATUSES.DRAFT, 'SUBMIT', {
      roles: ['leader'],
      windowOpen: true,
      teamCount: 2,
      teamSizeMin: 2,
    });
    expect(s1.to).toBe(PROPOSAL_STATUSES.SUBMITTED);

    const s2 = proposalMachine.next(s1.to, 'START_REVIEW', {
      roles: [ROLES.SUPERVISOR],
    });
    expect(s2.to).toBe(PROPOSAL_STATUSES.UNDER_REVIEW);

    const s3 = proposalMachine.next(s2.to, 'REQUEST_CHANGES', {
      roles: [ROLES.SUPERVISOR],
      comment: 'يرجى توضيح المخرجات',
    });
    expect(s3.to).toBe(PROPOSAL_STATUSES.NEEDS_CHANGES);

    const s4 = proposalMachine.next(s3.to, 'RESUBMIT', {
      roles: ['leader'],
      resubmitOpen: true,
      teamCount: 2,
      teamSizeMin: 2,
    });
    expect(s4.to).toBe(PROPOSAL_STATUSES.SUBMITTED);

    const s5 = proposalMachine.next(PROPOSAL_STATUSES.UNDER_REVIEW, 'RECOMMEND', {
      roles: [ROLES.SUPERVISOR],
      comment: 'مقترح جيد وموصى باعتماده',
    });
    expect(s5.to).toBe(PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED);

    const s6 = proposalMachine.next(s5.to, 'APPROVE', {
      roles: [ROLES.DEPARTMENT_ADMIN],
    });
    expect(s6.to).toBe(PROPOSAL_STATUSES.APPROVED);
  });

  it.each([
    {
      name: 'blocks SUBMIT when registration window is closed',
      state: PROPOSAL_STATUSES.DRAFT,
      event: 'SUBMIT',
      ctx: { roles: ['leader'], windowOpen: false, teamCount: 3, teamSizeMin: 2 },
      code: 'WINDOW_CLOSED',
    },
    {
      name: 'blocks SUBMIT when team is below minimum size',
      state: PROPOSAL_STATUSES.DRAFT,
      event: 'SUBMIT',
      ctx: { roles: ['leader'], windowOpen: true, teamCount: 1, teamSizeMin: 2 },
      code: 'TEAM_BELOW_MIN',
    },
    {
      name: 'blocks RESUBMIT after proposal deadline',
      state: PROPOSAL_STATUSES.NEEDS_CHANGES,
      event: 'RESUBMIT',
      ctx: { roles: ['leader'], resubmitOpen: false, teamCount: 2, teamSizeMin: 2 },
      code: 'WINDOW_CLOSED',
    },
    {
      name: 'blocks REQUEST_CHANGES without comment',
      state: PROPOSAL_STATUSES.UNDER_REVIEW,
      event: 'REQUEST_CHANGES',
      ctx: { roles: [ROLES.SUPERVISOR], comment: '   ' },
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'blocks RECOMMEND without comment',
      state: PROPOSAL_STATUSES.UNDER_REVIEW,
      event: 'RECOMMEND',
      ctx: { roles: [ROLES.SUPERVISOR], comment: '' },
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'blocks REJECT without comment',
      state: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
      event: 'REJECT',
      ctx: { roles: [ROLES.DEPARTMENT_ADMIN], comment: '' },
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'blocks student from APPROVE',
      state: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
      event: 'APPROVE',
      ctx: { roles: ['leader', ROLES.STUDENT] },
      code: 'FORBIDDEN',
    },
    {
      name: 'blocks supervisor from APPROVE directly',
      state: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
      event: 'APPROVE',
      ctx: { roles: [ROLES.SUPERVISOR] },
      code: 'FORBIDDEN',
    },
    {
      name: 'blocks leader transitions when leader is deactivated',
      state: PROPOSAL_STATUSES.DRAFT,
      event: 'SUBMIT',
      ctx: { roles: ['leader'], windowOpen: true, teamCount: 2, teamSizeMin: 1, leaderDeactivated: true },
      code: 'FORBIDDEN',
    },
    {
      name: 'blocks WITHDRAW after approval',
      state: PROPOSAL_STATUSES.APPROVED,
      event: 'WITHDRAW',
      ctx: { roles: ['leader'] },
      code: 'INVALID_TRANSITION',
    },
  ])('$name', ({ state, event, ctx, code }) => {
    const outcome = proposalMachine.evaluate(state, event, ctx);
    expect(outcome.allowed).toBe(false);
    expect(outcome.code).toBe(code);
  });

  it('supports admin RETURN to needs_changes and YEAR_ROLLOVER to archived', () => {
    const returned = proposalMachine.next(PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED, 'RETURN', {
      roles: [ROLES.COLLEGE_ADMIN],
      comment: 'مطلوب مراجعة الميزانية المبدئية',
    });
    expect(returned.to).toBe(PROPOSAL_STATUSES.NEEDS_CHANGES);

    const archived = proposalMachine.next(PROPOSAL_STATUSES.APPROVED, 'YEAR_ROLLOVER', {
      roles: ['system'],
    });
    expect(archived.to).toBe(PROPOSAL_STATUSES.ARCHIVED);
  });

  it('evaluates registration and resubmit windows inclusively', () => {
    const cycle = {
      registrationOpensAt: new Date('2026-09-01T00:00:00Z'),
      registrationClosesAt: new Date('2026-09-30T23:59:59Z'),
      proposalDeadline: new Date('2026-10-15T23:59:59Z'),
    };

    expect(isRegistrationOpen(cycle, new Date('2026-08-31T23:59:59Z'))).toBe(false);
    expect(isRegistrationOpen(cycle, new Date('2026-09-01T00:00:00Z'))).toBe(true);
    expect(isRegistrationOpen(cycle, new Date('2026-09-30T23:59:59Z'))).toBe(true);
    expect(isRegistrationOpen(cycle, new Date('2026-10-01T00:00:00Z'))).toBe(false);

    expect(isProposalResubmitOpen(cycle, new Date('2026-10-10T12:00:00Z'))).toBe(true);
    expect(isProposalResubmitOpen(cycle, new Date('2026-10-16T00:00:00Z'))).toBe(false);
    expect(isRegistrationOpen(null, new Date())).toBe(false);
  });
});
