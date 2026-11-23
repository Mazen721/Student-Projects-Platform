import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import Notification from '../../src/core/notifications/notification.model.js';
import { hashPassword } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';

function proposalPayload(overrides = {}) {
  return {
    title: 'منصة ذكية لإدارة الطاقة الشمسية في الحرم الجامعي',
    idea: 'نظام متكامل لقياس ومراقبة استهلاك الطاقة وإنتاج الألواح الشمسية لحظياً.',
    problem: 'صعوبة تتبع الهدر الكهربائي في مباني الجامعة بدون لوحة قياس دقيقة.',
    objectives: ['قياس الاستهلاك لحظياً', 'التنبؤ بالأحمال الكهربائية'],
    scope: 'مباني كلية الهندسة خلال العام الدراسي الحالي',
    field: 'renewable_energy',
    type: 'hybrid',
    beneficiaries: 'إدارة الصيانة والطلاب الباحثون في الطاقة',
    keywords: ['الطاقة الشمسية', 'إنترنت الأشياء'],
    expectedOutcomes: 'نموذج أولي متصل بلوحة متابعة وتقارير شهرية',
    ...overrides,
  };
}

describe('Projects, Proposals, Teams, Supervision & Ideas Integration (P2 / US2)', () => {
  let app;
  let collegeA;
  let collegeB;
  let deptA1;
  let deptB1;
  let ayA;
  let tokens;
  let users;

  async function loginAs(email, password) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
  }

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    collegeA = await College.create({
      name: 'كلية الهندسة',
      code: 'ENG',
      settings: {
        teamSizeMin: 2,
        teamSizeMax: 3,
        allowCrossCollege: false,
        supervisorPrimaryCap: 1,
      },
    });
    collegeB = await College.create({
      name: 'كلية الحاسبات',
      code: 'CS',
      settings: {
        teamSizeMin: 1,
        teamSizeMax: 4,
        allowCrossCollege: true,
        supervisorPrimaryCap: 2,
      },
    });
    deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    deptB1 = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    await PhaseTemplate.create({
      collegeId: collegeA._id,
      name: 'قالب افتراضي',
      isDefault: true,
      phases: [
        {
          key: 'p1',
          name: 'المرحلة الأولى',
          order: 1,
          weight: 100,
          dueOffsetDays: 30,
          requiredDeliverables: [{ key: 'd1', title: 'التقرير الأولي' }],
        },
      ],
    });

    const now = Date.now();
    ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * 86400000),
      endDate: new Date(now + 300 * 86400000),
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
      startDate: new Date(now - 30 * 86400000),
      endDate: new Date(now + 300 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 5 * 86400000),
        registrationClosesAt: new Date(now + 10 * 86400000),
        proposalDeadline: new Date(now + 20 * 86400000),
      },
    });

    const pw = await hashPassword('Password123');
    const makeUser = (doc) => User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const uniAdmin = await makeUser({
      name: 'مدير الجامعة',
      email: 'uni@mnu.edu.eg',
      accountType: 'staff',
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });
    const collegeAdminA = await makeUser({
      name: 'عميد الهندسة',
      email: 'cadmina@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const collegeAdminB = await makeUser({
      name: 'عميد الحاسبات',
      email: 'cadminb@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeB._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeB._id, collegeId: collegeB._id }],
    });
    const deptAdminA1 = await makeUser({
      name: 'رئيس قسم الحاسبات',
      email: 'dadmina1@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const supA1 = await makeUser({
      name: 'د. أحمد المشرف',
      email: 'supa1@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const supA2 = await makeUser({
      name: 'د. منى المشرف الثاني',
      email: 'supa2@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA1 = await makeUser({
      name: 'أحمد الطالب',
      email: 'sa1@mnu.edu.eg',
      studentId: '20261001',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA2 = await makeUser({
      name: 'سارة الطالبة',
      email: 'sa2@mnu.edu.eg',
      studentId: '20261002',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA3 = await makeUser({
      name: 'كريم الطالب',
      email: 'sa3@mnu.edu.eg',
      studentId: '20261003',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA4 = await makeUser({
      name: 'ندى الطالبة',
      email: 'sa4@mnu.edu.eg',
      studentId: '20261004',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentB1 = await makeUser({
      name: 'عمر من الحاسبات',
      email: 'sb1@mnu.edu.eg',
      studentId: '20262001',
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB1._id, collegeId: collegeB._id, departmentId: deptB1._id }],
    });
    const investor = await makeUser({
      name: 'شركة النيل التقنية',
      email: 'inv@niletech.com',
      accountType: 'investor',
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });

    users = {
      uniAdmin,
      collegeAdminA,
      collegeAdminB,
      deptAdminA1,
      supA1,
      supA2,
      studentA1,
      studentA2,
      studentA3,
      studentA4,
      studentB1,
      investor,
    };

    tokens = {
      uniAdmin: await loginAs('uni@mnu.edu.eg', 'Password123'),
      collegeAdminA: await loginAs('cadmina@mnu.edu.eg', 'Password123'),
      collegeAdminB: await loginAs('cadminb@mnu.edu.eg', 'Password123'),
      deptAdminA1: await loginAs('dadmina1@mnu.edu.eg', 'Password123'),
      supA1: await loginAs('supa1@mnu.edu.eg', 'Password123'),
      supA2: await loginAs('supa2@mnu.edu.eg', 'Password123'),
      studentA1: await loginAs('sa1@mnu.edu.eg', 'Password123'),
      studentA2: await loginAs('sa2@mnu.edu.eg', 'Password123'),
      studentA3: await loginAs('sa3@mnu.edu.eg', 'Password123'),
      studentA4: await loginAs('sa4@mnu.edu.eg', 'Password123'),
      studentB1: await loginAs('sb1@mnu.edu.eg', 'Password123'),
      investor: await loginAs('inv@niletech.com', 'Password123'),
    };
  });

  it('creates draft proposal, detects similar titles without blocking, enforces single-active-project lock, and rejects creation when window is closed', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send(proposalPayload());

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('draft');
    expect(createRes.body.data.team.leaderId).toBe(String(users.studentA1._id));

    // Same student cannot start a second active project in the same year
    const secondRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send(proposalPayload({ title: 'مشروع ثاني للطالب نفسه في نفس العام' }));
    expect(secondRes.status).toBe(422);
    expect(secondRes.body.error.rule).toBe('ALREADY_IN_ACTIVE_PROJECT');

    // Similar title warning returns candidates without blocking creation
    const simRes = await request(app)
      .get('/api/v1/projects/similar-titles')
      .set('Authorization', `Bearer ${tokens.studentA2}`)
      .query({ title: 'منصة ذكية لإدارة الطاقة الشمسية في الحرم' });
    expect(simRes.status).toBe(200);
    expect(simRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(simRes.body.data[0].title).toContain('الطاقة الشمسية');

    // Closed window blocks new proposal creation and includes window dates
    await AcademicYear.updateOne(
      { _id: ayA._id },
      { $set: { 'cycle.registrationClosesAt': new Date(Date.now() - 3600000) } }
    );
    const closedRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA2}`)
      .send(proposalPayload({ title: 'مشروع جديد بعد إغلاق نافذة التسجيل' }));
    expect(closedRes.status).toBe(409);
    expect(closedRes.body.error.code).toBe('WINDOW_CLOSED');
    expect(closedRes.body.error.details.registrationClosesAt).toBeTruthy();
  });

  it('enforces team size limits, cross-college disallow, and leadership transfer', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send(proposalPayload());
    const projectId = createRes.body.data._id;

    // Cross-college student rejected when allowCrossCollege is false
    const crossInvite = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentB1._id) });
    expect(crossInvite.status).toBe(422);
    expect(crossInvite.body.error.rule).toBe('CROSS_COLLEGE_NOT_ALLOWED');

    // Cannot submit with 1 member when teamSizeMin is 2
    const earlySubmit = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ event: 'SUBMIT' });
    expect(earlySubmit.status).toBe(422);
    expect(earlySubmit.body.error.rule).toBe('TEAM_BELOW_MIN');

    // Invite studentA2 and studentA3 (reaches max = 3)
    const inv2 = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentA2._id) });
    expect(inv2.status).toBe(201);

    const invList = await request(app)
      .get('/api/v1/me/team-invitations')
      .set('Authorization', `Bearer ${tokens.studentA2}`);
    expect(invList.status).toBe(200);
    expect(invList.body.data).toHaveLength(1);

    const accept2 = await request(app)
      .post(`/api/v1/team-invitations/${inv2.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentA2}`);
    expect(accept2.status).toBe(200);

    const inv3 = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentA3._id) });
    expect(inv3.status).toBe(201);
    await request(app)
      .post(`/api/v1/team-invitations/${inv3.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentA3}`);

    // 4th member blocked by TEAM_FULL (max = 3)
    const inv4 = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentA4._id) });
    expect(inv4.status).toBe(422);
    expect(inv4.body.error.rule).toBe('TEAM_FULL');

    // Leadership transfer from studentA1 to studentA2
    const transferRes = await request(app)
      .post(`/api/v1/projects/${projectId}/leadership-transfer`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ toUserId: String(users.studentA2._id) });
    expect(transferRes.status).toBe(201);

    const acceptTransfer = await request(app)
      .post(`/api/v1/leadership-transfers/${transferRes.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentA2}`);
    expect(acceptTransfer.status).toBe(200);
    expect(acceptTransfer.body.data.team.leaderId).toBe(String(users.studentA2._id));
  });

  it('runs the full two-step proposal workflow with versions, history, notifications, and locks team after approval', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send(proposalPayload());
    const projectId = createRes.body.data._id;

    // Add second member to satisfy teamSizeMin=2
    const inv2 = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentA2._id) });
    await request(app)
      .post(`/api/v1/team-invitations/${inv2.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentA2}`);

    // Assign reviewing supervisor so supervisor can review
    const assignRev = await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ reviewerId: String(users.supA1._id) });
    expect(assignRev.status).toBe(200);

    // Submit v1
    const submitRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ event: 'SUBMIT' });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('submitted');

    // Supervisor starts review -> requests changes
    const startRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'START_REVIEW' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('under_review');

    const changesRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'REQUEST_CHANGES', comment: 'أضف تفاصيل أجهزة القياس' });
    expect(changesRes.status).toBe(200);
    expect(changesRes.body.data.status).toBe('needs_changes');

    const notifCount = await Notification.countDocuments({ userId: users.studentA1._id });
    expect(notifCount).toBeGreaterThanOrEqual(1);

    // Edit in needs_changes and resubmit -> creates v2
    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ scope: 'مباني كلية الهندسة بالكامل مع مستشعرات ESP32' });
    expect(patchRes.status).toBe(200);

    const resubmitRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ event: 'RESUBMIT' });
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.data.status).toBe('submitted');

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'START_REVIEW' });

    const recommendRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'RECOMMEND', comment: 'مكتمل وموصى باعتماده' });
    expect(recommendRes.status).toBe(200);
    expect(recommendRes.body.data.status).toBe('supervisor_recommended');

    const approveRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ event: 'APPROVE' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // History and versions preserved
    const histRes = await request(app)
      .get(`/api/v1/projects/${projectId}/history`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.history.length).toBeGreaterThanOrEqual(6);
    expect(histRes.body.data.versions.length).toBeGreaterThanOrEqual(2);

    const v1Res = await request(app)
      .get(`/api/v1/projects/${projectId}/versions/1`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(v1Res.status).toBe(200);
    expect(v1Res.body.data.snapshot.scope).toBe('مباني كلية الهندسة خلال العام الدراسي الحالي');

    // Student cannot leave after approval
    const leaveAfter = await request(app)
      .post(`/api/v1/projects/${projectId}/team/leave`)
      .set('Authorization', `Bearer ${tokens.studentA2}`);
    expect(leaveAfter.status).toBe(422);
    expect(leaveAfter.body.error.rule).toBe('LOCKED_AFTER_APPROVAL');
  });

  it('enforces supervisor primary capacity cap with College Admin audited override and supports cross-college partner summary', async () => {
    // Allow cross-college for collegeA for this test
    await College.updateOne({ _id: collegeA._id }, { $set: { 'settings.allowCrossCollege': true } });

    const p1 = (
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokens.studentA1}`)
        .send(proposalPayload({ title: 'مشروع أول لاختبار نصاب المشرف' }))
    ).body.data;
    const p2 = (
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokens.studentA3}`)
        .send(proposalPayload({ title: 'مشروع ثاني لاختبار نصاب المشرف' }))
    ).body.data;

    // Invite studentB1 (collegeB) into p1 so collegeB becomes a partnerCollege
    const crossInv = await request(app)
      .post(`/api/v1/projects/${p1._id}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentB1._id) });
    expect(crossInv.status).toBe(201);
    await request(app)
      .post(`/api/v1/team-invitations/${crossInv.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentB1}`);

    // Assign supA1 as primary on p1 (cap = 1)
    const assign1 = await request(app)
      .put(`/api/v1/projects/${p1._id}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ primaryId: String(users.supA1._id) });
    expect(assign1.status).toBe(200);

    // Check supervisor load endpoint
    const loadRes = await request(app)
      .get('/api/v1/supervisors/load')
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .query({ academicYearId: String(ayA._id) });
    expect(loadRes.status).toBe(200);
    const sup1Load = loadRes.body.data.find((s) => s.supervisorId === String(users.supA1._id));
    expect(sup1Load.primaryCount).toBe(1);
    expect(sup1Load.isFull).toBe(true);

    // Dept admin blocked from exceeding cap on p2 even with overrideReason
    const deptCapFail = await request(app)
      .put(`/api/v1/projects/${p2._id}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ primaryId: String(users.supA1._id), overrideReason: 'محاولة تجاوز غير مصرح بها' });
    expect(deptCapFail.status).toBe(422);
    expect(deptCapFail.body.error.rule).toBe('SUPERVISOR_AT_CAPACITY');

    // College admin allowed with mandatory overrideReason, written to audit log
    const collegeOverride = await request(app)
      .put(`/api/v1/projects/${p2._id}/supervision`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send({ primaryId: String(users.supA1._id), overrideReason: 'تخصص نادر في الأنظمة المدمجة' });
    expect(collegeOverride.status).toBe(200);

    const overrideAudit = await AuditLog.findOne({
      action: 'supervision.override',
      'scope.projectId': p2._id,
    }).lean();
    expect(overrideAudit).toBeTruthy();
    expect(overrideAudit.reason).toBe('تخصص نادر في الأنظمة المدمجة');

    // Partner collegeAdminB can read summary of p1 but NOT full project read
    const fullDeny = await request(app)
      .get(`/api/v1/projects/${p1._id}`)
      .set('Authorization', `Bearer ${tokens.collegeAdminB}`);
    expect(fullDeny.status).toBe(404);

    const summaryOk = await request(app)
      .get(`/api/v1/projects/${p1._id}/summary`)
      .set('Authorization', `Bearer ${tokens.collegeAdminB}`);
    expect(summaryOk.status).toBe(200);
    expect(summaryOk.body.data.title).toBe('مشروع أول لاختبار نصاب المشرف');
    expect(summaryOk.body.data.partnerMembers.length).toBe(1);
  });

  it('creates an idea in ideas bank, approves adoption request into a prefilled draft, and marks idea taken', async () => {
    const ideaRes = await request(app)
      .post('/api/v1/ideas')
      .set('Authorization', `Bearer ${tokens.investor}`)
      .send({
        title: 'منصة تحليل صور الأشعة بالذكاء الاصطناعي',
        description: 'تطبيق طبي لتحليل صور الأشعة المقطعية وتنبيه الأطباء للحالات الحرجة.',
        field: 'ai',
        type: 'software',
        collegeId: String(collegeA._id),
      });
    expect(ideaRes.status).toBe(201);
    const ideaId = ideaRes.body.data._id;

    const reqRes = await request(app)
      .post(`/api/v1/ideas/${ideaId}/adoption-requests`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({});
    expect(reqRes.status).toBe(201);

    const acceptRes = await request(app)
      .post(`/api/v1/adoption-requests/${reqRes.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.investor}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.idea.status).toBe('taken');
    expect(acceptRes.body.data.project.title).toBe('منصة تحليل صور الأشعة بالذكاء الاصطناعي');
    expect(acceptRes.body.data.project.ideaId).toBe(ideaId);
  });

  it('cascades impostor deactivation (FR-013a) to remove project memberships cleanly', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send(proposalPayload());
    const projectId = createRes.body.data._id;

    const inv2 = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ inviteeId: String(users.studentA2._id) });
    await request(app)
      .post(`/api/v1/team-invitations/${inv2.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.studentA2}`);

    const deactRes = await request(app)
      .post(`/api/v1/users/${users.studentA2._id}/deactivate`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send({ reason: 'حساب منتحل', releaseIdentifiers: true });
    expect(deactRes.status).toBe(200);

    const projAfter = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(projAfter.status).toBe(200);
    expect(projAfter.body.data.activeMemberIds).not.toContain(String(users.studentA2._id));
  });
});
