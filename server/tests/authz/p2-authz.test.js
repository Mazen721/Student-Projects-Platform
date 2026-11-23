import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';

describe('P2 Authorization Matrix (Projects, Teams, Supervision, Ideas)', () => {
  let app;
  let ids;
  let tokens;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    const collegeA = await College.create({
      name: 'كلية الهندسة',
      code: 'ENG',
      settings: { teamSizeMin: 1, teamSizeMax: 4, allowCrossCollege: false, supervisorPrimaryCap: 5 },
    });
    const collegeB = await College.create({
      name: 'كلية الحاسبات',
      code: 'CS',
      settings: { teamSizeMin: 1, teamSizeMax: 4, allowCrossCollege: false, supervisorPrimaryCap: 5 },
    });
    const deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    const deptA2 = await Department.create({ name: 'هندسة القوى', code: 'EE', collegeId: collegeA._id });
    const deptB1 = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    const now = Date.now();
    const ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 20 * 86400000),
      endDate: new Date(now + 200 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 5 * 86400000),
        registrationClosesAt: new Date(now + 10 * 86400000),
        proposalDeadline: new Date(now + 20 * 86400000),
      },
    });
    await AcademicYear.create({
      collegeId: collegeB._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 20 * 86400000),
      endDate: new Date(now + 200 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 5 * 86400000),
        registrationClosesAt: new Date(now + 10 * 86400000),
        proposalDeadline: new Date(now + 20 * 86400000),
      },
    });

    const pw = await hashPassword('Password123');
    const createU = (doc) => User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const deptAdminA1 = await createU({
      name: 'رئيس قسم أ1',
      email: 'da1@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const deptAdminA2 = await createU({
      name: 'رئيس قسم أ2',
      email: 'da2@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA2._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA2._id, collegeId: collegeA._id, departmentId: deptA2._id }],
    });
    const collegeAdminB = await createU({
      name: 'عميد ب',
      email: 'cb@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeB._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeB._id, collegeId: collegeB._id }],
    });
    const supA1 = await createU({
      name: 'مشرف أ1',
      email: 'supa1@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA1 = await createU({
      name: 'طالب أ1',
      email: 'sa1@mnu.edu.eg',
      studentId: '202601',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA2 = await createU({
      name: 'طالب أ2',
      email: 'sa2@mnu.edu.eg',
      studentId: '202602',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentB1 = await createU({
      name: 'طالب ب1',
      email: 'sb1@mnu.edu.eg',
      studentId: '202603',
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB1._id, collegeId: collegeB._id, departmentId: deptB1._id }],
    });
    const investor = await createU({
      name: 'مستثمر نشط',
      email: 'inv@corp.com',
      accountType: 'investor',
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });
    const visitor = await createU({
      name: 'زائر',
      email: 'vis@corp.com',
      accountType: 'visitor',
      roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
    });

    tokens = {
      deptAdminA1: signAccessToken(deptAdminA1),
      deptAdminA2: signAccessToken(deptAdminA2),
      collegeAdminB: signAccessToken(collegeAdminB),
      supA1: signAccessToken(supA1),
      studentA1: signAccessToken(studentA1),
      studentA2: signAccessToken(studentA2),
      studentB1: signAccessToken(studentB1),
      investor: signAccessToken(investor),
      visitor: signAccessToken(visitor),
    };

    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        title: 'نظام إدارة المستشفيات الذكية',
        idea: 'تطبيق لجدولة مواعيد العيادات وإدارة الملف الطبي.',
        problem: 'ازدحام العيادات وفقدان السجلات الورقية.',
        objectives: ['حجز المواعيد إلكترونياً'],
        scope: 'العيادات الخارجية',
        field: 'software_engineering',
        type: 'software',
        beneficiaries: 'المرضى والأطباء',
        keywords: ['صحة'],
        expectedOutcomes: 'تطبيق ويب متكامل',
      });
    expect(projRes.status).toBe(201);

    const ideaRes = await request(app)
      .post('/api/v1/ideas')
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({
        title: 'فكرة مساعدة ذكية للمكفوفين',
        description: 'نظام يقرأ اللوحات الإرشادية صوتياً باستخدام الكاميرا.',
        field: 'ai',
        type: 'hybrid',
        collegeId: String(collegeA._id),
      });
    expect(ideaRes.status).toBe(201);

    ids = {
      projectId: projRes.body.data._id,
      ideaId: ideaRes.body.data._id,
      ayAId: String(ayA._id),
      collegeBId: String(collegeB._id),
      supA1Id: String(supA1._id),
      studentA2Id: String(studentA2._id),
    };
  });

  it.each([
    {
      name: 'leader reads own project',
      actor: 'studentA1',
      method: 'get',
      url: () => `/api/v1/projects/${ids.projectId}`,
      expectedStatus: 200,
    },
    {
      name: 'unrelated student in same dept denied reading project (404)',
      actor: 'studentA2',
      method: 'get',
      url: () => `/api/v1/projects/${ids.projectId}`,
      expectedStatus: 404,
    },
    {
      name: 'other-department admin denied reading project (404)',
      actor: 'deptAdminA2',
      method: 'get',
      url: () => `/api/v1/projects/${ids.projectId}`,
      expectedStatus: 404,
    },
    {
      name: 'cross-college admin denied reading project (404)',
      actor: 'collegeAdminB',
      method: 'get',
      url: () => `/api/v1/projects/${ids.projectId}`,
      expectedStatus: 404,
    },
    {
      name: 'in-scope deptAdminA1 reads project',
      actor: 'deptAdminA1',
      method: 'get',
      url: () => `/api/v1/projects/${ids.projectId}`,
      expectedStatus: 200,
    },
    {
      name: 'visitor denied creating proposal (403)',
      actor: 'visitor',
      method: 'post',
      url: () => '/api/v1/projects',
      body: { title: 'غير مصرح' },
      expectedStatus: 403,
    },
    {
      name: 'non-leader student denied inviting to another project (404)',
      actor: 'studentA2',
      method: 'post',
      url: () => `/api/v1/projects/${ids.projectId}/team/invitations`,
      body: () => ({ inviteeId: ids.studentA2Id }),
      expectedStatus: 404,
    },
    {
      name: 'deptAdminA1 assigns supervision in own department',
      actor: 'deptAdminA1',
      method: 'put',
      url: () => `/api/v1/projects/${ids.projectId}/supervision`,
      body: () => ({ primaryId: ids.supA1Id }),
      expectedStatus: 200,
    },
    {
      name: 'collegeAdminB denied assigning supervision in collegeA (404)',
      actor: 'collegeAdminB',
      method: 'put',
      url: () => `/api/v1/projects/${ids.projectId}/supervision`,
      body: () => ({ primaryId: ids.supA1Id }),
      expectedStatus: 404,
    },
    {
      name: 'student denied creating idea in ideas bank (403)',
      actor: 'studentB1',
      method: 'post',
      url: () => '/api/v1/ideas',
      body: {
        title: 'فكرة غير مصرح بها',
        description: 'وصف طويل لفكرة من طالب لا يملك صلاحية نشر أفكار.',
        field: 'ai',
        type: 'software',
      },
      expectedStatus: 403,
    },
    {
      name: 'non-owner investor denied updating supervisor idea (404)',
      actor: 'investor',
      method: 'patch',
      url: () => `/api/v1/ideas/${ids.ideaId}`,
      body: { title: 'تعديل مرفوض' },
      expectedStatus: 404,
    },
    {
      name: 'collegeAdminB denied removing collegeA idea (404)',
      actor: 'collegeAdminB',
      method: 'post',
      url: () => `/api/v1/ideas/${ids.ideaId}/remove`,
      body: { reason: 'محاولة إزالة خارج النطاق' },
      expectedStatus: 404,
    },
  ])('$name', async ({ actor, method, url, body, expectedStatus }) => {
    const req = request(app)[method](url()).set('Authorization', `Bearer ${tokens[actor]}`);
    const payload = typeof body === 'function' ? body() : body;
    const res = payload ? await req.send(payload) : await req;
    expect(res.status).toBe(expectedStatus);
  });
});
