import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  PROPOSAL_STATUSES,
  ROLES,
  SCOPE_TYPES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';

const DAY = 24 * 60 * 60 * 1000;

describe('P7 Authorization Matrix (Dashboards & Reports)', () => {
  let app;
  let tokens;
  let ids;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    const collegeA = await College.create({ name: 'كلية الهندسة', code: 'ENG' });
    const collegeB = await College.create({ name: 'كلية الحاسبات', code: 'CS' });
    const deptA = await Department.create({
      name: 'هندسة الحاسبات',
      code: 'CE',
      collegeId: collegeA._id,
    });
    const deptB = await Department.create({
      name: 'علوم الحاسب',
      code: 'CS1',
      collegeId: collegeB._id,
    });

    const now = Date.now();
    const ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * DAY),
      endDate: new Date(now + 200 * DAY),
      cycle: {
        registrationOpensAt: new Date(now - 10 * DAY),
        registrationClosesAt: new Date(now + 20 * DAY),
        proposalDeadline: new Date(now + 25 * DAY),
      },
    });
    const ayB = await AcademicYear.create({
      collegeId: collegeB._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * DAY),
      endDate: new Date(now + 200 * DAY),
      cycle: {
        registrationOpensAt: new Date(now - 10 * DAY),
        registrationClosesAt: new Date(now + 20 * DAY),
        proposalDeadline: new Date(now + 25 * DAY),
      },
    });

    const pw = await hashPassword('Password123');
    const makeUser = (doc) =>
      User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const uniAdmin = await makeUser({
      name: 'مدير الجامعة',
      email: 'uni@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });
    const collegeAdminA = await makeUser({
      name: 'عميد الهندسة',
      email: 'ca@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeA._id,
      roles: [
        {
          role: ROLES.COLLEGE_ADMIN,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeA._id,
          collegeId: collegeA._id,
        },
      ],
    });
    const deptAdminA = await makeUser({
      name: 'رئيس قسم الهندسة',
      email: 'da@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.DEPARTMENT_ADMIN,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA._id,
          collegeId: collegeA._id,
          departmentId: deptA._id,
        },
      ],
    });
    const supervisor = await makeUser({
      name: 'د. مشرف',
      email: 'sup@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.SUPERVISOR,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA._id,
          collegeId: collegeA._id,
          departmentId: deptA._id,
        },
      ],
    });
    const dualRoleUser = await makeUser({
      name: 'مسؤول ومشرف',
      email: 'dual@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.COLLEGE_ADMIN,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeA._id,
          collegeId: collegeA._id,
        },
        {
          role: ROLES.SUPERVISOR,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA._id,
          collegeId: collegeA._id,
          departmentId: deptA._id,
        },
      ],
    });
    const student = await makeUser({
      name: 'طالب',
      email: 'st@mnu.edu.eg',
      studentId: '2026001',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA._id,
          collegeId: collegeA._id,
          departmentId: deptA._id,
        },
      ],
    });
    const investor = await makeUser({
      name: 'مستثمر',
      email: 'inv@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.INVESTOR,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });

    await Project.create({
      title: 'مشروع الهندسة',
      slug: 'eng-project',
      idea: 'فكرة',
      problem: 'مشكلة',
      scope: 'نطاق',
      field: 'ai',
      type: 'software',
      beneficiaries: 'المستفيدون',
      expectedOutcomes: 'النتائج',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: '2026/2027',
      status: PROPOSAL_STATUSES.APPROVED,
      team: { leaderId: student._id, members: [{ userId: student._id, role: 'leader' }] },
      activeMemberIds: [student._id],
      supervision: { primaryId: supervisor._id },
    });

    tokens = {
      uniAdmin: signAccessToken(uniAdmin),
      collegeAdminA: signAccessToken(collegeAdminA),
      deptAdminA: signAccessToken(deptAdminA),
      supervisor: signAccessToken(supervisor),
      dualRoleUser: signAccessToken(dualRoleUser),
      student: signAccessToken(student),
      investor: signAccessToken(investor),
    };

    ids = {
      collegeAId: String(collegeA._id),
      collegeBId: String(collegeB._id),
      deptAId: String(deptA._id),
      deptBId: String(deptB._id),
      ayAId: String(ayA._id),
      ayBId: String(ayB._id),
      dualSupRoleId: String(dualRoleUser.roles[1]._id),
    };
  });

  const policyCases = [
    ['report.dashboard (uniAdmin)', '/api/v1/reports/dashboard', () => ({ yearLabel: '2026/2027' }), 'uniAdmin', 200, 'student', 403],
    ['report.dashboard (supervisor)', '/api/v1/reports/dashboard', () => ({ yearLabel: '2026/2027' }), 'supervisor', 200, 'investor', 403],
    ['report.projects', '/api/v1/reports/projects', () => ({ academicYearId: ids.ayAId }), 'collegeAdminA', 200, 'supervisor', 403],
    ['report.completion', '/api/v1/reports/completion', () => ({ academicYearId: ids.ayAId }), 'deptAdminA', 200, 'student', 403],
    ['report.supervisors', '/api/v1/reports/supervisor-distribution', () => ({ academicYearId: ids.ayAId }), 'collegeAdminA', 200, 'supervisor', 403],
    ['report.evaluation', '/api/v1/reports/evaluation', () => ({ academicYearId: ids.ayAId }), 'deptAdminA', 200, 'student', 403],
    ['report.insights', '/api/v1/reports/insights', () => ({ academicYearId: ids.ayAId }), 'collegeAdminA', 200, 'supervisor', 403],
    ['report.supervisorSelf', '/api/v1/reports/supervisor/me', () => ({ yearLabel: '2026/2027' }), 'supervisor', 200, 'collegeAdminA', 403],
  ];

  it.each(policyCases)(
    '%s: allows authorized role and denies unauthorized role',
    async (_label, path, buildQuery, allowActor, allowStatus, denyActor, denyStatus) => {
      const query = buildQuery();
      const allowRes = await request(app)
        .get(path)
        .query(query)
        .set('Authorization', `Bearer ${tokens[allowActor]}`);
      expect(allowRes.status).toBe(allowStatus);

      const denyRes = await request(app)
        .get(path)
        .query(query)
        .set('Authorization', `Bearer ${tokens[denyActor]}`);
      expect(denyRes.status).toBe(denyStatus);
    }
  );

  it('denies cross-college or cross-department drill-down queries with 404 NOT_FOUND', async () => {
    const crossCollege = await request(app)
      .get('/api/v1/reports/completion')
      .query({ yearLabel: '2026/2027', collegeId: ids.collegeBId })
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`);
    expect(crossCollege.status).toBe(404);

    const crossDept = await request(app)
      .get('/api/v1/reports/projects')
      .query({ academicYearId: ids.ayAId, departmentId: ids.deptBId })
      .set('Authorization', `Bearer ${tokens.deptAdminA}`);
    expect(crossDept.status).toBe(404);
  });

  it('enforces X-Role-Context restriction when a dual-role user switches to supervisor', async () => {
    const res = await request(app)
      .get('/api/v1/reports/projects')
      .query({ academicYearId: ids.ayAId })
      .set('Authorization', `Bearer ${tokens.dualRoleUser}`)
      .set('X-Role-Context', ids.dualSupRoleId);
    expect(res.status).toBe(403);
  });
});
