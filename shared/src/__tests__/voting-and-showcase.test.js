import { describe, expect, it } from 'vitest';
import {
  CONTACT_REQUEST_STATES,
  ROLES,
  SHOWCASE_STATES,
  USER_STATUSES,
} from '../constants/index.js';
import { computeTrending } from '../calc/trending.js';
import { voteEligibility } from '../calc/voteEligibility.js';
import { contactRequestMachine } from '../machines/contactRequestMachine.js';
import { showcaseMachine } from '../machines/showcaseMachine.js';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-05-01T12:00:00.000Z');

function user(overrides = {}) {
  return {
    id: 'user-1',
    _id: 'user-1',
    status: USER_STATUSES.ACTIVE,
    accountType: 'student',
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    id: 'project-1',
    _id: 'project-1',
    status: 'approved',
    activeMemberIds: ['leader-1'],
    team: {
      leaderId: 'leader-1',
      members: [{ userId: 'leader-1', role: 'leader', status: 'active' }],
    },
    supervision: {
      primaryId: 'supervisor-1',
      coSupervisorIds: ['co-1'],
      mentorIds: ['mentor-1'],
      reviewerId: null,
    },
    supervisorIds: ['supervisor-1', 'co-1', 'mentor-1'],
    ...overrides,
  };
}

describe('showcaseMachine (mini-site publication lifecycle)', () => {
  it('requires an approved project and a team member to request publication', () => {
    const blocked = showcaseMachine.evaluate(SHOWCASE_STATES.DRAFT, 'REQUEST_PUBLISH', {
      roles: ['teamMember'],
      projectApproved: false,
    });
    expect(blocked).toEqual({ allowed: false, code: 'PROJECT_NOT_APPROVED' });

    const forbidden = showcaseMachine.evaluate(SHOWCASE_STATES.DRAFT, 'REQUEST_PUBLISH', {
      roles: [ROLES.SUPERVISOR],
      projectApproved: true,
    });
    expect(forbidden).toEqual({ allowed: false, code: 'FORBIDDEN' });

    const requested = showcaseMachine.next(SHOWCASE_STATES.DRAFT, 'REQUEST_PUBLISH', {
      roles: ['teamMember'],
      projectApproved: true,
    });
    expect(requested.to).toBe(SHOWCASE_STATES.PENDING_APPROVAL);
  });

  it('allows only supervisors and in-scope admins to approve first publication', () => {
    expect(
      showcaseMachine.evaluate(SHOWCASE_STATES.PENDING_APPROVAL, 'APPROVE', {
        roles: ['teamMember'],
        projectApproved: true,
      }).allowed
    ).toBe(false);

    const approved = showcaseMachine.next(SHOWCASE_STATES.PENDING_APPROVAL, 'APPROVE', {
      roles: [ROLES.SUPERVISOR],
      projectApproved: true,
    });
    expect(approved.to).toBe(SHOWCASE_STATES.PUBLISHED);

    const approvedByAdmin = showcaseMachine.next(SHOWCASE_STATES.PENDING_APPROVAL, 'APPROVE', {
      roles: [ROLES.COLLEGE_ADMIN],
      projectApproved: true,
    });
    expect(approvedByAdmin.to).toBe(SHOWCASE_STATES.PUBLISHED);
  });

  it('requires a rejection reason and returns the page to draft', () => {
    expect(
      showcaseMachine.evaluate(SHOWCASE_STATES.PENDING_APPROVAL, 'REJECT_PUBLISH', {
        roles: [ROLES.SUPERVISOR],
        reason: '  ',
      }).code
    ).toBe('VALIDATION_ERROR');

    const rejected = showcaseMachine.next(SHOWCASE_STATES.PENDING_APPROVAL, 'REJECT_PUBLISH', {
      roles: [ROLES.SUPERVISOR],
      reason: 'محتوى الصفحة غير مكتمل',
    });
    expect(rejected.to).toBe(SHOWCASE_STATES.DRAFT);
  });

  it('publishes an ever-approved page after unpublish and blocks first-time direct publish', () => {
    expect(
      showcaseMachine.evaluate(SHOWCASE_STATES.UNPUBLISHED, 'PUBLISH', {
        roles: ['teamMember'],
        everApproved: false,
      }).code
    ).toBe('PUBLISH_REQUIRES_APPROVAL');

    const published = showcaseMachine.next(SHOWCASE_STATES.UNPUBLISHED, 'PUBLISH', {
      roles: ['teamMember'],
      everApproved: true,
    });
    expect(published.to).toBe(SHOWCASE_STATES.PUBLISHED);
  });

  it('requires an audited reason for takedown and forces fresh approval afterwards', () => {
    expect(
      showcaseMachine.evaluate(SHOWCASE_STATES.PUBLISHED, 'TAKE_DOWN', {
        roles: [ROLES.COLLEGE_ADMIN],
        reason: '',
      }).code
    ).toBe('VALIDATION_ERROR');

    const takenDown = showcaseMachine.next(SHOWCASE_STATES.PUBLISHED, 'TAKE_DOWN', {
      roles: [ROLES.COLLEGE_ADMIN],
      reason: 'مخالفة سياسة المحتوى',
    });
    expect(takenDown.to).toBe(SHOWCASE_STATES.TAKEN_DOWN);

    const reRequested = showcaseMachine.next(SHOWCASE_STATES.TAKEN_DOWN, 'REQUEST_PUBLISH', {
      roles: ['teamMember'],
      projectApproved: true,
    });
    expect(reRequested.to).toBe(SHOWCASE_STATES.PENDING_APPROVAL);
  });

  it('supports system auto-takedown when the project is rejected or approval is revoked', () => {
    const auto = showcaseMachine.next(SHOWCASE_STATES.PUBLISHED, 'AUTO_TAKE_DOWN', {
      roles: ['system'],
      reason: 'تم إلغاء اعتماد المشروع',
    });
    expect(auto.to).toBe(SHOWCASE_STATES.TAKEN_DOWN);
  });
});

describe('contactRequestMachine', () => {
  it('allows only the team leader to accept or decline a pending request', () => {
    expect(
      contactRequestMachine.evaluate(CONTACT_REQUEST_STATES.PENDING, 'ACCEPT', {
        roles: ['teamMember'],
      })
    ).toEqual({ allowed: false, code: 'FORBIDDEN' });

    const accepted = contactRequestMachine.next(CONTACT_REQUEST_STATES.PENDING, 'ACCEPT', {
      roles: ['leader'],
    });
    expect(accepted.to).toBe(CONTACT_REQUEST_STATES.ACCEPTED);

    const declined = contactRequestMachine.next(CONTACT_REQUEST_STATES.PENDING, 'DECLINE', {
      roles: ['leader'],
    });
    expect(declined.to).toBe(CONTACT_REQUEST_STATES.DECLINED);
  });

  it('lets an investor withdraw only a pending request and blocks repeated decisions', () => {
    const withdrawn = contactRequestMachine.next(CONTACT_REQUEST_STATES.PENDING, 'WITHDRAW', {
      roles: ['investor'],
    });
    expect(withdrawn.to).toBe(CONTACT_REQUEST_STATES.WITHDRAWN);

    expect(
      contactRequestMachine.evaluate(CONTACT_REQUEST_STATES.ACCEPTED, 'ACCEPT', {
        roles: ['leader'],
      })
    ).toEqual({ allowed: false, code: 'INVALID_TRANSITION' });
  });
});

describe('voteEligibility', () => {
  it('accepts an active, old-enough, unrelated account', () => {
    expect(
      voteEligibility({ user: user(), project: project(), now: NOW, minAccountAgeHours: 24 })
    ).toEqual({ eligible: true });
  });

  it('rejects pending or deactivated accounts', () => {
    expect(
      voteEligibility({
        user: user({ status: USER_STATUSES.PENDING }),
        project: project(),
        now: NOW,
        minAccountAgeHours: 24,
      }).code
    ).toBe('ACCOUNT_INACTIVE');

    expect(
      voteEligibility({
        user: user({ status: USER_STATUSES.DEACTIVATED }),
        project: project(),
        now: NOW,
        minAccountAgeHours: 24,
      }).code
    ).toBe('ACCOUNT_INACTIVE');
  });

  it('enforces the configurable minimum account age and returns the available time', () => {
    const young = user({ createdAt: new Date(NOW.getTime() - 2 * HOUR) });
    const result = voteEligibility({
      user: young,
      project: project(),
      now: NOW,
      minAccountAgeHours: 24,
    });
    expect(result.eligible).toBe(false);
    expect(result.code).toBe('VOTE_ACCOUNT_TOO_NEW');
    expect(result.availableAt).toEqual(new Date(young.createdAt.getTime() + 24 * HOUR));
  });

  it('blocks team members, primary/co-supervisors, mentors and reviewers from self-voting', () => {
    const cases = [
      { activeMemberIds: ['user-1'] },
      { team: { leaderId: 'user-1', members: [] }, activeMemberIds: [] },
      { supervision: { primaryId: 'user-1', coSupervisorIds: [], mentorIds: [], reviewerId: null } },
      { supervision: { primaryId: 'supervisor-1', coSupervisorIds: ['user-1'], mentorIds: [], reviewerId: null } },
      { supervision: { primaryId: 'supervisor-1', coSupervisorIds: [], mentorIds: ['user-1'], reviewerId: null } },
      { supervision: { primaryId: 'supervisor-1', coSupervisorIds: [], mentorIds: [], reviewerId: 'user-1' } },
    ];

    for (const overrides of cases) {
      const result = voteEligibility({
        user: user(),
        project: project(overrides),
        now: NOW,
        minAccountAgeHours: 24,
      });
      expect(result).toEqual({ eligible: false, code: 'SELF_VOTE' });
    }
  });

  it('blocks voting outside an open competition window and for ineligible projects', () => {
    const closed = voteEligibility({
      user: user(),
      project: project(),
      competition: {
        startsAt: new Date(NOW.getTime() - 48 * HOUR),
        endsAt: new Date(NOW.getTime() - HOUR),
        voterRestriction: 'all',
      },
      now: NOW,
      minAccountAgeHours: 24,
    });
    expect(closed).toEqual({ eligible: false, code: 'COMPETITION_CLOSED' });

    const notStarted = voteEligibility({
      user: user(),
      project: project(),
      competition: {
        startsAt: new Date(NOW.getTime() + HOUR),
        endsAt: new Date(NOW.getTime() + 48 * HOUR),
        voterRestriction: 'all',
      },
      now: NOW,
      minAccountAgeHours: 24,
    });
    expect(notStarted).toEqual({ eligible: false, code: 'COMPETITION_CLOSED' });

    const notEligible = voteEligibility({
      user: user(),
      project: project(),
      competition: {
        startsAt: new Date(NOW.getTime() - HOUR),
        endsAt: new Date(NOW.getTime() + HOUR),
        eligibleProjectIds: ['another-project'],
        voterRestriction: 'all',
      },
      now: NOW,
      minAccountAgeHours: 24,
    });
    expect(notEligible).toEqual({ eligible: false, code: 'PROJECT_NOT_ELIGIBLE' });
  });

  it('restricts university-only competitions to student and staff accounts', () => {
    const competition = {
      startsAt: new Date(NOW.getTime() - HOUR),
      endsAt: new Date(NOW.getTime() + HOUR),
      voterRestriction: 'university_only',
    };

    expect(
      voteEligibility({
        user: user({ accountType: 'investor' }),
        project: project(),
        competition,
        now: NOW,
        minAccountAgeHours: 24,
      })
    ).toEqual({ eligible: false, code: 'VOTER_NOT_UNIVERSITY' });

    expect(
      voteEligibility({
        user: user({ accountType: 'visitor' }),
        project: project(),
        competition,
        now: NOW,
        minAccountAgeHours: 24,
      })
    ).toEqual({ eligible: false, code: 'VOTER_NOT_UNIVERSITY' });

    expect(
      voteEligibility({
        user: user({ accountType: 'staff' }),
        project: project(),
        competition,
        now: NOW,
        minAccountAgeHours: 24,
      })
    ).toEqual({ eligible: true });
  });
});

describe('computeTrending', () => {
  it('weights the last seven days of valid votes by three plus unique views', () => {
    expect(computeTrending({ votes7d: 4, views7d: 10 })).toBe(22);
    expect(computeTrending({ votes7d: 0, views7d: 0 })).toBe(0);
    expect(computeTrending({ votes7d: 2.5, views7d: 3 })).toBe(10.5);
  });

  it('tolerates missing counters', () => {
    expect(computeTrending({})).toBe(0);
  });
});
