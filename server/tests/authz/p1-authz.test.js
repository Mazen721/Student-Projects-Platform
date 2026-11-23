import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import Invitation from '../../src/modules/auth/invitation.model.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';

describe('P1 Authorization Matrix (In-Scope Positive & Out-of-Scope Negative)', () => {
  let app;
  let ids;
  let tokens;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    const collegeA = await College.create({ name: 'كلية الهندسة', code: 'ENG' });
    const collegeB = await College.create({ name: 'كلية الحاسبات', code: 'CS' });
    const deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    const deptB1 = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });
    const ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      cycle: {
        registrationOpensAt: new Date('2026-09-10'),
        registrationClosesAt: new Date('2026-10-10'),
        proposalDeadline: new Date('2026-10-20'),
      },
    });
    const ayB = await AcademicYear.create({
      collegeId: collegeB._id,
      label: '2026/2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      cycle: {
        registrationOpensAt: new Date('2026-09-10'),
        registrationClosesAt: new Date('2026-10-10'),
        proposalDeadline: new Date('2026-10-20'),
      },
    });

    const pw = await hashPassword('Password123');
    const uniAdmin = await User.create({
      name: 'مدير الجامعة',
      email: 'uadmin@mnu.edu.eg',
      passwordHash: pw,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });
    const collegeAdminA = await User.create({
      name: 'مدير كلية أ',
      email: 'cadmina@mnu.edu.eg',
      passwordHash: pw,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const deptAdminA1 = await User.create({
      name: 'مدير قسم أ1',
      email: 'dadmina1@mnu.edu.eg',
      passwordHash: pw,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA1 = await User.create({
      name: 'طالب أ1',
      email: 'studenta1@mnu.edu.eg',
      studentId: '20260010',
      passwordHash: pw,
      status: USER_STATUSES.ACTIVE,
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentB1 = await User.create({
      name: 'طالب ب1',
      email: 'studentb1@mnu.edu.eg',
      studentId: '20260020',
      passwordHash: pw,
      status: USER_STATUSES.ACTIVE,
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB1._id, collegeId: collegeB._id, departmentId: deptB1._id }],
    });
    const pendingInvestor = await User.create({
      name: 'مستثمر معلق',
      email: 'pinv@corp.com',
      passwordHash: pw,
      status: USER_STATUSES.PENDING,
      accountType: 'investor',
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });

    const inviteB = await Invitation.create({
      kind: 'role',
      tokenHash: 'hash-invite-b',
      role: ROLES.SUPERVISOR,
      scopeType: SCOPE_TYPES.COLLEGE,
      scopeId: collegeB._id,
      collegeId: collegeB._id,
      createdBy: uniAdmin._id,
      expiresAt: new Date(Date.now() + 86400000),
    });

    ids = {
      collegeA: String(collegeA._id),
      collegeB: String(collegeB._id),
      deptA1: String(deptA1._id),
      deptB1: String(deptB1._id),
      ayA: String(ayA._id),
      ayB: String(ayB._id),
      studentA1: String(studentA1._id),
      studentB1: String(studentB1._id),
      pendingInvestor: String(pendingInvestor._id),
      inviteB: String(inviteB._id),
    };

    tokens = {
      uniAdmin: signAccessToken(uniAdmin),
      collegeAdminA: signAccessToken(collegeAdminA),
      deptAdminA1: signAccessToken(deptAdminA1),
      studentA1: signAccessToken(studentA1),
      pendingInvestor: signAccessToken(pendingInvestor),
    };
  });

  const cases = [
    { name: 'universityAdmin reads university settings', actor: 'uniAdmin', method: 'get', path: () => '/api/v1/university', expected: [200] },
    { name: 'universityAdmin updates university settings', actor: 'uniAdmin', method: 'patch', path: () => '/api/v1/university/settings', body: { minVoteAccountAgeHours: 12 }, expected: [200] },
    { name: 'collegeAdmin denied updating university settings', actor: 'collegeAdminA', method: 'patch', path: () => '/api/v1/university/settings', body: { minVoteAccountAgeHours: 12 }, expected: [403] },

    { name: 'universityAdmin creates college', actor: 'uniAdmin', method: 'post', path: () => '/api/v1/colleges', body: { name: 'كلية العلوم', code: 'SCI' }, expected: [201] },
    { name: 'collegeAdmin denied creating college', actor: 'collegeAdminA', method: 'post', path: () => '/api/v1/colleges', body: { name: 'كلية العلوم', code: 'SCI' }, expected: [403] },

    { name: 'collegeAdminA reads own college', actor: 'collegeAdminA', method: 'get', path: () => `/api/v1/colleges/${ids.collegeA}`, expected: [200] },
    { name: 'collegeAdminA denied reading collegeB (404)', actor: 'collegeAdminA', method: 'get', path: () => `/api/v1/colleges/${ids.collegeB}`, expected: [404] },
    { name: 'collegeAdminA updates own college settings', actor: 'collegeAdminA', method: 'patch', path: () => `/api/v1/colleges/${ids.collegeA}/settings`, body: { passMark: 65 }, expected: [200] },
    { name: 'collegeAdminA denied updating collegeB settings (404)', actor: 'collegeAdminA', method: 'patch', path: () => `/api/v1/colleges/${ids.collegeB}/settings`, body: { passMark: 65 }, expected: [404] },

    { name: 'collegeAdminA creates department in collegeA', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/colleges/${ids.collegeA}/departments`, body: { name: 'مدني', code: 'CIV' }, expected: [201] },
    { name: 'collegeAdminA denied creating department in collegeB (404)', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/colleges/${ids.collegeB}/departments`, body: { name: 'نظم', code: 'IS' }, expected: [404] },

    { name: 'deptAdminA1 updates own department', actor: 'deptAdminA1', method: 'patch', path: () => `/api/v1/departments/${ids.deptA1}`, body: { name: 'هندسة الحاسبات والنظم' }, expected: [200] },
    { name: 'deptAdminA1 denied updating collegeB department (404)', actor: 'deptAdminA1', method: 'patch', path: () => `/api/v1/departments/${ids.deptB1}`, body: { name: 'تعديل' }, expected: [404] },

    { name: 'collegeAdminA sets current academic year in collegeA', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/academic-years/${ids.ayA}/set-current`, body: {}, expected: [200] },
    { name: 'collegeAdminA denied setting current academic year in collegeB (404)', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/academic-years/${ids.ayB}/set-current`, body: {}, expected: [404] },

    { name: 'collegeAdminA reads student in collegeA', actor: 'collegeAdminA', method: 'get', path: () => `/api/v1/users/${ids.studentA1}`, expected: [200] },
    { name: 'collegeAdminA denied reading student in collegeB (404)', actor: 'collegeAdminA', method: 'get', path: () => `/api/v1/users/${ids.studentB1}`, expected: [404] },
    { name: 'collegeAdminA resets password for student in collegeA', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/users/${ids.studentA1}/reset-password`, body: {}, expected: [200] },
    { name: 'collegeAdminA denied resetting password in collegeB (404)', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/users/${ids.studentB1}/reset-password`, body: {}, expected: [404] },
    { name: 'collegeAdminA denied deactivating pending investor without college (404)', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/users/${ids.pendingInvestor}/deactivate`, body: { reason: 'اختبار' }, expected: [404] },

    { name: 'collegeAdminA denied revoking collegeB invitation (404)', actor: 'collegeAdminA', method: 'post', path: () => `/api/v1/invitations/${ids.inviteB}/revoke`, body: {}, expected: [404] },
    { name: 'studentA1 denied listing users', actor: 'studentA1', method: 'get', path: () => '/api/v1/users', expected: [403] },
    { name: 'studentA1 searches teammates', actor: 'studentA1', method: 'get', path: () => '/api/v1/users/search?q=طالب', expected: [200] },
    { name: 'pendingInvestor allowed on /auth/me', actor: 'pendingInvestor', method: 'get', path: () => '/api/v1/auth/me', expected: [200] },
    { name: 'pendingInvestor denied on /users/me/profile update', actor: 'pendingInvestor', method: 'patch', path: () => '/api/v1/users/me/profile', body: { bio: 'x' }, expected: [403] },
    { name: 'studentA1 denied listing audit logs', actor: 'studentA1', method: 'get', path: () => '/api/v1/audit-logs', expected: [403] },
    { name: 'deptAdminA1 allowed listing audit logs (scoped)', actor: 'deptAdminA1', method: 'get', path: () => '/api/v1/audit-logs', expected: [200] },
  ];

  it.each(cases)('$name', async ({ actor, method, path, body, expected }) => {
    const req = request(app)[method](path()).set('Authorization', `Bearer ${tokens[actor]}`);
    const res = body ? await req.send(body) : await req;
    expect(expected).toContain(res.status);
  });
});
