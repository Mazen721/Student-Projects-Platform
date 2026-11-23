import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/core/auth/tokens.js';
import { AUTHZ_SYMBOL, assertAllRoutesGuarded } from '../../src/core/authz/authorize.js';
import { can } from '../../src/core/authz/can.js';
import { POLICIES } from '../../src/core/authz/policies.js';
import { buildScopeFilter } from '../../src/core/authz/scopeFilter.js';

const oid = () => new mongoose.Types.ObjectId();

function makeIds() {
  return {
    collegeA: oid(),
    collegeB: oid(),
    deptA: oid(),
    deptB: oid(),
    projectA: oid(),
    defenseA: oid(),
    channelA: oid(),
    uniAdmin: oid(),
    collegeAdminA: oid(),
    collegeAdminB: oid(),
    deptAdminA: oid(),
    deptAdminB: oid(),
    partnerCollegeAdmin: oid(),
    supervisorA: oid(),
    coSupervisorA: oid(),
    studentLeader: oid(),
    studentTeammate: oid(),
    studentInvitee: oid(),
    studentB: oid(),
    committeeChair: oid(),
    committeeExaminer: oid(),
    investor: oid(),
    pendingInvestor: oid(),
    visitor: oid(),
    deactivatedUser: oid(),
  };
}

function makeActors(ids) {
  const mk = (id, role, extra = {}) => ({
    _id: id,
    id: String(id),
    status: USER_STATUSES.ACTIVE,
    roles: [{ role, ...extra }],
  });

  return {
    uniAdmin: mk(ids.uniAdmin, ROLES.UNIVERSITY_ADMIN, { scopeType: SCOPE_TYPES.UNIVERSITY }),
    collegeAdminA: mk(ids.collegeAdminA, ROLES.COLLEGE_ADMIN, {
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: ids.collegeA,
      collegeId: ids.collegeA,
    }),
    collegeAdminB: mk(ids.collegeAdminB, ROLES.COLLEGE_ADMIN, {
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: ids.collegeB,
      collegeId: ids.collegeB,
    }),
    partnerCollegeAdmin: mk(ids.partnerCollegeAdmin, ROLES.COLLEGE_ADMIN, {
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: ids.collegeB,
      collegeId: ids.collegeB,
    }),
    deptAdminA: mk(ids.deptAdminA, ROLES.DEPARTMENT_ADMIN, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    deptAdminB: mk(ids.deptAdminB, ROLES.DEPARTMENT_ADMIN, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptB,
      collegeId: ids.collegeB,
      departmentId: ids.deptB,
    }),
    supervisorA: mk(ids.supervisorA, ROLES.SUPERVISOR, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    coSupervisorA: mk(ids.coSupervisorA, ROLES.SUPERVISOR, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    studentLeader: mk(ids.studentLeader, ROLES.STUDENT, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    studentTeammate: mk(ids.studentTeammate, ROLES.STUDENT, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    studentInvitee: mk(ids.studentInvitee, ROLES.STUDENT, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA,
      collegeId: ids.collegeA,
      departmentId: ids.deptA,
    }),
    studentB: mk(ids.studentB, ROLES.STUDENT, {
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptB,
      collegeId: ids.collegeB,
      departmentId: ids.deptB,
    }),
    committeeChair: mk(ids.committeeChair, ROLES.COMMITTEE_MEMBER, {
      scopeType: SCOPE_TYPES.DEFENSE,
      scopeId: ids.defenseA,
      defenseId: ids.defenseA,
    }),
    committeeExaminer: mk(ids.committeeExaminer, ROLES.COMMITTEE_MEMBER, {
      scopeType: SCOPE_TYPES.DEFENSE,
      scopeId: ids.defenseA,
      defenseId: ids.defenseA,
    }),
    investor: mk(ids.investor, ROLES.INVESTOR, { scopeType: SCOPE_TYPES.SELF }),
    pendingInvestor: {
      _id: ids.pendingInvestor,
      id: String(ids.pendingInvestor),
      status: USER_STATUSES.PENDING,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    },
    visitor: mk(ids.visitor, ROLES.VISITOR, { scopeType: SCOPE_TYPES.SELF }),
    deactivatedUser: {
      _id: ids.deactivatedUser,
      id: String(ids.deactivatedUser),
      status: USER_STATUSES.DEACTIVATED,
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    },
  };
}

function buildMatrixSpecs(ids) {
  const collegeScopeA = { collegeId: ids.collegeA };
  const collegeScopeB = { collegeId: ids.collegeB };
  const deptScopeA = { collegeId: ids.collegeA, departmentId: ids.deptA };
  const deptScopeB = { collegeId: ids.collegeB, departmentId: ids.deptB };
  const projectScopeA = {
    projectId: ids.projectA,
    collegeId: ids.collegeA,
    departmentId: ids.deptA,
    partnerCollegeIds: [ids.collegeB],
    partnerDepartmentIds: [ids.deptB],
    leaderId: ids.studentLeader,
    activeMemberIds: [ids.studentLeader, ids.studentTeammate],
    supervisorId: ids.supervisorA,
    coSupervisorIds: [ids.coSupervisorA],
    mentorIds: [],
  };
  const projectScopeB = {
    projectId: oid(),
    collegeId: ids.collegeB,
    departmentId: ids.deptB,
    leaderId: ids.studentB,
    activeMemberIds: [ids.studentB],
    supervisorId: oid(),
    coSupervisorIds: [],
    mentorIds: [],
  };
  const defenseScopeA = {
    ...projectScopeA,
    defenseId: ids.defenseA,
    defenseState: 'grading',
    chairId: ids.committeeChair,
    examinerIds: [ids.committeeChair, ids.committeeExaminer],
  };

  return {
    'self.read': { allow: ['pendingInvestor', {}], deny: ['deactivatedUser', {}] },
    'self.update': { allow: ['studentLeader', {}], deny: ['pendingInvestor', {}] },
    'self.changePassword': { allow: ['pendingInvestor', {}], deny: ['deactivatedUser', {}] },
    'user.read': {
      allow: ['deptAdminA', { userId: ids.studentLeader, ...deptScopeA }],
      deny: ['deptAdminA', { userId: ids.studentB, ...deptScopeB }],
    },
    'user.list': { allow: ['collegeAdminA', collegeScopeA], deny: ['studentLeader', {}] },
    'user.searchForTeam': { allow: ['studentLeader', {}], deny: ['visitor', {}] },
    'user.deactivate': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'user.reactivate': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'user.resetPassword': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'role.assign': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'role.revoke': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'invitation.create': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'invitation.revoke': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'investor.review': { allow: ['uniAdmin', {}], deny: ['collegeAdminA', {}] },
    'university.read': { allow: ['visitor', {}], deny: ['deactivatedUser', {}] },
    'university.update': { allow: ['uniAdmin', {}], deny: ['collegeAdminA', {}] },
    'college.list': { allow: ['collegeAdminA', {}], deny: ['studentLeader', {}] },
    'college.create': { allow: ['uniAdmin', {}], deny: ['collegeAdminA', {}] },
    'college.read': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'college.update': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'college.updateSettings': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'college.deactivate': { allow: ['uniAdmin', collegeScopeA], deny: ['collegeAdminA', collegeScopeA] },
    'department.list': { allow: ['studentLeader', collegeScopeA], deny: ['studentLeader', collegeScopeB] },
    'department.create': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'department.update': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'department.deactivate': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'academicYear.list': { allow: ['supervisorA', collegeScopeA], deny: ['supervisorA', collegeScopeB] },
    'academicYear.create': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'academicYear.update': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'academicYear.rollover': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'import.run': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'audit.list': { allow: ['deptAdminA', deptScopeA], deny: ['supervisorA', deptScopeA] },
    'dashboard.home': { allow: ['pendingInvestor', {}], deny: ['deactivatedUser', {}] },
    'project.list': { allow: ['studentLeader', deptScopeA], deny: ['investor', {}] },
    'proposal.create': { allow: ['studentLeader', {}], deny: ['supervisorA', {}] },
    'project.read': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'project.readSummary': { allow: ['partnerCollegeAdmin', projectScopeA], deny: ['collegeAdminA', projectScopeB] },
    'proposal.update': { allow: ['studentLeader', projectScopeA], deny: ['studentTeammate', projectScopeA] },
    'proposal.transition': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'team.invite': { allow: ['studentLeader', projectScopeA], deny: ['studentTeammate', projectScopeA] },
    'team.respond': { allow: ['studentInvitee', { inviteeId: ids.studentInvitee }], deny: ['studentB', { inviteeId: ids.studentInvitee }] },
    'team.removeMember': { allow: ['studentLeader', projectScopeA], deny: ['studentB', projectScopeA] },
    'team.leave': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'team.moveMember': { allow: ['deptAdminA', deptScopeA], deny: ['studentLeader', projectScopeA] },
    'team.transferLeadership': { allow: ['studentLeader', projectScopeA], deny: ['studentTeammate', projectScopeA] },
    'team.respondTransfer': { allow: ['studentTeammate', { toUserId: ids.studentTeammate }], deny: ['studentB', { toUserId: ids.studentTeammate }] },
    'supervision.assign': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'supervision.viewLoad': { allow: ['deptAdminA', deptScopeA], deny: ['supervisorA', deptScopeA] },
    'idea.list': { allow: ['investor', {}], deny: ['visitor', {}] },
    'idea.create': { allow: ['investor', {}], deny: ['studentLeader', {}] },
    'idea.update': { allow: ['investor', { ownerId: ids.investor }], deny: ['supervisorA', { ownerId: ids.investor }] },
    'idea.remove': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'idea.requestAdoption': { allow: ['studentLeader', {}], deny: ['investor', {}] },
    'idea.decideAdoption': { allow: ['supervisorA', { ownerId: ids.supervisorA }], deny: ['studentLeader', { ownerId: ids.supervisorA }] },
    'phaseTemplate.list': { allow: ['supervisorA', collegeScopeA], deny: ['studentLeader', collegeScopeA] },
    'phaseTemplate.create': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'phaseTemplate.update': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'phase.adjust': { allow: ['supervisorA', projectScopeA], deny: ['coSupervisorA', projectScopeA] },
    'phase.markComplete': { allow: ['supervisorA', projectScopeA], deny: ['studentLeader', projectScopeA] },
    'submission.create': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'submission.review': { allow: ['supervisorA', projectScopeA], deny: ['coSupervisorA', projectScopeA] },
    'project.setStatusFlag': { allow: ['supervisorA', projectScopeA], deny: ['studentLeader', projectScopeA] },
    'task.list': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'task.create': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'task.update': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'task.delete': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'bom.read': { allow: ['coSupervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'bom.write': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'tools.read': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'tools.write': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'meeting.read': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'meeting.write': { allow: ['coSupervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'channel.list': { allow: ['studentTeammate', projectScopeA], deny: ['visitor', {}] },
    'channel.createDirect': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'channel.read': {
      allow: [
        'studentTeammate',
        { ...projectScopeA, kind: 'team_only', channelMemberIds: [ids.studentLeader, ids.studentTeammate] },
      ],
      deny: [
        'supervisorA',
        { ...projectScopeA, kind: 'team_only', channelMemberIds: [ids.studentLeader, ids.supervisorA] },
      ],
    },
    'channel.write': {
      allow: ['studentLeader', { ...projectScopeA, kind: 'project_group', channelMemberIds: [ids.studentLeader] }],
      deny: ['studentB', { ...projectScopeA, kind: 'project_group', channelMemberIds: [ids.studentLeader] }],
    },
    'content.moderate': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'comment.read': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'comment.create': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'announcement.create': { allow: ['supervisorA', deptScopeA], deny: ['studentLeader', deptScopeA] },
    'announcement.list': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'notification.list': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'notification.update': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'media.read': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'media.write': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'mediaItem.remove': { allow: ['deptAdminA', deptScopeA], deny: ['supervisorA', projectScopeA] },
    'rubric.list': { allow: ['supervisorA', collegeScopeA], deny: ['studentLeader', collegeScopeA] },
    'rubric.create': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'rubric.update': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'defense.list': { allow: ['supervisorA', deptScopeA], deny: ['studentLeader', deptScopeA] },
    'defense.read': { allow: ['committeeExaminer', defenseScopeA], deny: ['studentB', defenseScopeA] },
    'defense.signOff': { allow: ['supervisorA', projectScopeA], deny: ['coSupervisorA', projectScopeA] },
    'defense.schedule': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'score.submit': { allow: ['committeeExaminer', defenseScopeA], deny: ['committeeExaminer', { ...defenseScopeA, defenseState: 'finalized', examinerIds: [] }] },
    'score.viewAll': { allow: ['committeeChair', defenseScopeA], deny: ['studentLeader', defenseScopeA] },
    'defense.transition': { allow: ['committeeChair', defenseScopeA], deny: ['committeeExaminer', defenseScopeA] },
    'defense.recordMinutes': { allow: ['committeeChair', defenseScopeA], deny: ['supervisorA', defenseScopeA] },
    'defense.confirmModifications': { allow: ['supervisorA', projectScopeA], deny: ['committeeChair', defenseScopeA] },
    'grade.read': { allow: ['partnerCollegeAdmin', projectScopeA], deny: ['studentB', projectScopeA] },
    'grade.readStudentFinal': { allow: ['studentTeammate', projectScopeA], deny: ['supervisorA', projectScopeA] },
    'reeval.request': { allow: ['studentLeader', projectScopeA], deny: ['studentB', projectScopeA] },
    'reeval.list': { allow: ['collegeAdminA', collegeScopeA], deny: ['deptAdminA', deptScopeA] },
    'reeval.decide': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'certificate.download': {
      allow: ['studentTeammate', { ...projectScopeA, studentId: ids.studentTeammate }],
      deny: ['studentLeader', { ...projectScopeA, studentId: ids.studentTeammate }],
    },
    'showcase.edit': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'showcase.transition': { allow: ['supervisorA', projectScopeA], deny: ['studentB', projectScopeA] },
    'showcase.feature': { allow: ['uniAdmin', {}], deny: ['collegeAdminA', {}] },
    'vote.cast': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'vote.withdraw': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'vote.review': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'competition.create': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'investor.follow': { allow: ['investor', {}], deny: ['pendingInvestor', {}] },
    'investor.bookmark': { allow: ['investor', {}], deny: ['studentLeader', {}] },
    'contact.request': { allow: ['investor', {}], deny: ['visitor', {}] },
    'contact.list': { allow: ['studentTeammate', projectScopeA], deny: ['investor', projectScopeA] },
    'contact.decide': { allow: ['studentLeader', projectScopeA], deny: ['studentTeammate', projectScopeA] },
    'challenge.list': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'challenge.create': { allow: ['investor', {}], deny: ['studentLeader', {}] },
    'challenge.remove': { allow: ['collegeAdminA', collegeScopeA], deny: ['collegeAdminA', collegeScopeB] },
    'publicComment.create': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'publicComment.report': { allow: ['visitor', {}], deny: ['pendingInvestor', {}] },
    'publicComment.moderate': { allow: ['studentTeammate', projectScopeA], deny: ['studentB', projectScopeA] },
    'report.dashboard': { allow: ['supervisorA', deptScopeA], deny: ['studentLeader', deptScopeA] },
    'report.projects': { allow: ['deptAdminA', deptScopeA], deny: ['supervisorA', deptScopeA] },
    'report.completion': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'report.supervisors': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'report.evaluation': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'report.insights': { allow: ['deptAdminA', deptScopeA], deny: ['deptAdminA', deptScopeB] },
    'report.supervisorSelf': { allow: ['supervisorA', {}], deny: ['studentLeader', {}] },
    'upload.sign': { allow: ['studentTeammate', projectScopeA], deny: ['pendingInvestor', projectScopeA] },
  };
}

describe('Full Authorization Matrix (100% of policies.js + route guard audit)', () => {
  const ids = makeIds();
  const actors = makeActors(ids);
  const matrix = buildMatrixSpecs(ids);
  const policyKeys = Object.keys(POLICIES);

  it('covers 100% of actions declared in policies.js with no missing or extra entries', () => {
    expect(Object.keys(matrix).sort()).toEqual([...policyKeys].sort());
  });

  it.each(policyKeys)('action %s: allows valid in-scope actor and denies out-of-scope actor', (action) => {
    const spec = matrix[action];
    const [allowActorKey, allowScope] = spec.allow;
    const [denyActorKey, denyScope] = spec.deny;

    expect(can(actors[allowActorKey], action, allowScope)).toBe(true);
    expect(can(actors[denyActorKey], action, denyScope)).toBe(false);
    expect(can(null, action, allowScope)).toBe(false);
  });

  it('guarantees every /api/v1 route in Express app carries an authz or publicRoute marker', () => {
    const app = createApp();
    expect(() => assertAllRoutesGuarded(app)).not.toThrow();

    const guardedMarkers = [];
    function collect(stack) {
      for (const layer of stack || []) {
        if (layer.route) {
          const marker = layer.route.stack.find((l) => l.handle?.[AUTHZ_SYMBOL])?.handle?.[AUTHZ_SYMBOL];
          if (marker) guardedMarkers.push(marker);
        } else if (layer.name === 'router' && layer.handle?.stack) {
          collect(layer.handle.stack);
        }
      }
    }
    collect(app._router.stack);
    expect(guardedMarkers.length).toBeGreaterThan(80);
  });

  it('rejects unauthenticated access to protected endpoints and rejects invalid X-Role-Context', async () => {
    const app = createApp();
    const resUnauth = await request(app).get('/api/v1/reports/dashboard?yearLabel=2026/2027');
    expect(resUnauth.status).toBe(401);

    const token = signAccessToken({
      _id: ids.collegeAdminA,
      tokenVersion: 0,
      mustChangePassword: false,
    });
    const resBadCtx = await request(app)
      .get('/api/v1/colleges')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Role-Context', oid());
    expect([401, 403]).toContain(resBadCtx.status);

    expect(buildScopeFilter(actors.collegeAdminA, 'report.completion')).toEqual({
      collegeId: String(ids.collegeA),
    });
    expect(buildScopeFilter(actors.deptAdminA, 'report.completion')).toEqual({
      departmentId: String(ids.deptA),
    });
  });
});
