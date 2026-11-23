import { describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES } from '@spp/shared/constants';
import { can } from '../../src/core/authz/can.js';
import { buildScopeFilter, resolveRoleContext } from '../../src/core/authz/scopeFilter.js';

const ids = {
  uni: '65f000000000000000000001',
  collegeA: '65f000000000000000000011',
  collegeB: '65f000000000000000000012',
  deptA1: '65f000000000000000000021',
  deptA2: '65f000000000000000000022',
  deptB1: '65f000000000000000000023',
  projA1: '65f000000000000000000031',
  leader: '65f000000000000000000101',
  member: '65f000000000000000000102',
  outsiderStudent: '65f000000000000000000103',
  supervisor: '65f000000000000000000201',
  coSupervisor: '65f000000000000000000202',
  mentor: '65f000000000000000000203',
  uniAdmin: '65f000000000000000000301',
  collegeAdminA: '65f000000000000000000302',
  collegeAdminB: '65f000000000000000000303',
  deptAdminA1: '65f000000000000000000304',
  investorApproved: '65f000000000000000000401',
  investorPending: '65f000000000000000000402',
  multiRoleUser: '65f000000000000000000501',
  roleAssignCollegeA: '65f000000000000000000601',
  roleAssignSupervisor: '65f000000000000000000602',
};

function makeUser(id, status, roles) {
  return { _id: id, id, status, roles };
}

const projectScope = {
  kind: 'project',
  projectId: ids.projA1,
  collegeId: ids.collegeA,
  departmentId: ids.deptA1,
  partnerCollegeIds: [ids.collegeB],
  partnerDepartmentIds: [ids.deptB1],
  leaderId: ids.leader,
  activeMemberIds: [ids.leader, ids.member],
  supervisorId: ids.supervisor,
  coSupervisorIds: [ids.coSupervisor],
  mentorIds: [ids.mentor],
  status: 'approved',
};

describe('Central Authorization — can(user, action, scope)', () => {
  const universityAdmin = makeUser(ids.uniAdmin, 'active', [
    { _id: 'r1', role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY },
  ]);
  const collegeAdminA = makeUser(ids.collegeAdminA, 'active', [
    { _id: 'r2', role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: ids.collegeA, collegeId: ids.collegeA },
  ]);
  const collegeAdminB = makeUser(ids.collegeAdminB, 'active', [
    { _id: 'r3', role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: ids.collegeB, collegeId: ids.collegeB },
  ]);
  const deptAdminA1 = makeUser(ids.deptAdminA1, 'active', [
    {
      _id: 'r4',
      role: ROLES.DEPARTMENT_ADMIN,
      scopeType: SCOPE_TYPES.DEPARTMENT,
      scopeId: ids.deptA1,
      collegeId: ids.collegeA,
      departmentId: ids.deptA1,
    },
  ]);

  it.each([
    ['universityAdmin updates any college', universityAdmin, 'college.update', { collegeId: ids.collegeB }, true],
    ['collegeAdmin updates own college', collegeAdminA, 'college.update', { collegeId: ids.collegeA }, true],
    ['collegeAdmin denied on other college', collegeAdminA, 'college.update', { collegeId: ids.collegeB }, false],
    ['collegeAdmin updates department inside own college', collegeAdminA, 'department.update', { collegeId: ids.collegeA, departmentId: ids.deptA1 }, true],
    ['collegeAdmin denied on department in other college', collegeAdminA, 'department.update', { collegeId: ids.collegeB, departmentId: ids.deptB1 }, false],
    ['departmentAdmin updates own department', deptAdminA1, 'department.update', { collegeId: ids.collegeA, departmentId: ids.deptA1 }, true],
    ['departmentAdmin denied on sibling department', deptAdminA1, 'department.update', { collegeId: ids.collegeA, departmentId: ids.deptA2 }, false],
    ['departmentAdmin denied on college settings', deptAdminA1, 'college.updateSettings', { collegeId: ids.collegeA }, false],
  ])('hierarchy check: %s', (_label, actor, action, scope, expected) => {
    expect(can(actor, action, scope)).toBe(expected);
  });

  const leaderUser = makeUser(ids.leader, 'active', [
    { _id: 's1', role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, collegeId: ids.collegeA, departmentId: ids.deptA1 },
  ]);
  const memberUser = makeUser(ids.member, 'active', [
    { _id: 's2', role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, collegeId: ids.collegeA, departmentId: ids.deptA1 },
  ]);
  const outsiderStudent = makeUser(ids.outsiderStudent, 'active', [
    { _id: 's3', role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, collegeId: ids.collegeA, departmentId: ids.deptA1 },
  ]);
  const supervisorUser = makeUser(ids.supervisor, 'active', [
    { _id: 'sup1', role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.COLLEGE, collegeId: ids.collegeA },
  ]);
  const coSupervisorUser = makeUser(ids.coSupervisor, 'active', [
    { _id: 'sup2', role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.COLLEGE, collegeId: ids.collegeA },
  ]);

  it.each([
    ['leader can invite teammates', leaderUser, 'team.invite', projectScope, true],
    ['non-leader member cannot invite teammates', memberUser, 'team.invite', projectScope, false],
    ['member can create submission', memberUser, 'submission.create', projectScope, true],
    ['outsider student cannot read project', outsiderStudent, 'project.read', projectScope, false],
    ['primary supervisor can sign off defense', supervisorUser, 'defense.signOff', projectScope, true],
    ['co-supervisor cannot sign off defense', coSupervisorUser, 'defense.signOff', projectScope, false],
    ['primary supervisor can review submission', supervisorUser, 'submission.review', projectScope, true],
  ])('project relationship check: %s', (_label, actor, action, scope, expected) => {
    expect(can(actor, action, scope)).toBe(expected);
  });

  it('enforces team_only channel isolation against supervisors', () => {
    const teamOnlyChannel = {
      ...projectScope,
      kind: 'team_only',
      channelMemberIds: [ids.leader, ids.member],
    };
    const groupChannel = {
      ...projectScope,
      kind: 'project_group',
      channelMemberIds: [ids.leader, ids.member, ids.supervisor],
    };

    expect(can(memberUser, 'channel.read', teamOnlyChannel)).toBe(true);
    expect(can(supervisorUser, 'channel.read', teamOnlyChannel)).toBe(false);
    expect(can(collegeAdminA, 'channel.read', teamOnlyChannel)).toBe(false);
    expect(can(supervisorUser, 'channel.read', groupChannel)).toBe(true);
  });

  it('allows cross-college partner admins read-only summary and partner final grade only', () => {
    expect(can(collegeAdminB, 'project.readSummary', projectScope)).toBe(true);
    expect(can(collegeAdminB, 'grade.readStudentFinal', projectScope)).toBe(true);
    expect(can(collegeAdminB, 'project.read', projectScope)).toBe(false);
    expect(can(collegeAdminB, 'proposal.transition', projectScope)).toBe(false);
  });

  it('denies non-active users and pending investors from privileged actions', () => {
    const pendingInvestor = makeUser(ids.investorPending, 'pending', [
      { _id: 'inv1', role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF },
    ]);
    const approvedInvestor = makeUser(ids.investorApproved, 'active', [
      { _id: 'inv2', role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF },
    ]);
    const deactivatedAdmin = makeUser(ids.uniAdmin, 'deactivated', [
      { _id: 'r1', role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY },
    ]);

    expect(can(pendingInvestor, 'investor.follow', { published: true })).toBe(false);
    expect(can(approvedInvestor, 'investor.follow', { published: true })).toBe(true);
    expect(can(deactivatedAdmin, 'college.create', {})).toBe(false);
  });

  it('supports X-Role-Context narrowing and rejects invalid context ids', () => {
    const multiRoleUser = makeUser(ids.multiRoleUser, 'active', [
      {
        _id: ids.roleAssignCollegeA,
        role: ROLES.COLLEGE_ADMIN,
        scopeType: SCOPE_TYPES.COLLEGE,
        scopeId: ids.collegeA,
        collegeId: ids.collegeA,
      },
      {
        _id: ids.roleAssignSupervisor,
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.COLLEGE,
        scopeId: ids.collegeA,
        collegeId: ids.collegeA,
      },
    ]);

    const narrowed = resolveRoleContext(multiRoleUser, ids.roleAssignSupervisor);
    expect(narrowed.roles).toHaveLength(1);
    expect(narrowed.roles[0].role).toBe(ROLES.SUPERVISOR);

    expect(() => resolveRoleContext(multiRoleUser, 'nonexistent-role-id')).toThrow();

    const adminFilter = buildScopeFilter(
      resolveRoleContext(multiRoleUser, ids.roleAssignCollegeA),
      'project.list'
    );
    expect(adminFilter).toEqual({
      $or: [{ collegeId: ids.collegeA }, { partnerCollegeIds: ids.collegeA }],
    });

    const supervisorFilter = buildScopeFilter(narrowed, 'project.list');
    expect(supervisorFilter).toEqual({ supervisorIds: ids.multiRoleUser });
  });
});
