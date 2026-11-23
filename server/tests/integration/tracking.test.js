import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import cloudinary from '../../src/config/cloudinary.js';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import Notification from '../../src/core/notifications/notification.model.js';
import { hashPassword } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import { runDeadlineReminders } from '../../src/jobs/deadlineReminders.js';

async function signAndBuildUploadResult(app, token, { purpose, projectId, fileName, mimeType, bytes }) {
  const signRes = await request(app)
    .post('/api/v1/uploads/sign')
    .set('Authorization', `Bearer ${token}`)
    .send({ purpose, projectId, fileName, mimeType, bytes });
  expect(signRes.status).toBe(200);
  const s = signRes.body.data;
  const fullPublicId = `${s.folder}/${s.publicId}`;
  const version = 1795000001;
  const signature = cloudinary.utils.api_sign_request(
    { public_id: fullPublicId, version },
    process.env.CLOUDINARY_API_SECRET
  );
  const format = fileName.split('.').pop().toLowerCase();
  return {
    public_id: fullPublicId,
    version,
    signature,
    resource_type: s.resourceType,
    type: s.type,
    format,
    bytes,
    secure_url: `https://res.cloudinary.com/test-cloud/${s.resourceType}/${s.type}/v${version}/${fullPublicId}.${format}`,
    original_filename: fileName.replace(/\.[^.]+$/, ''),
  };
}

function buildTemplatePayload(overrides = {}) {
  const now = Date.now();
  return {
    name: 'قالب تخرج كلية الهندسة 2026',
    isDefault: true,
    phases: [
      {
        key: 'analysis',
        name: 'التحليل والتصميم',
        order: 1,
        weight: 20,
        dueDate: new Date(now + 3 * 86400000).toISOString(),
        requiredDeliverables: [
          { key: 'srs', title: 'وثيقة المتطلبات SRS', allowedTypes: ['pdf', 'docx'] },
          { key: 'erd', title: 'مخطط قاعدة البيانات', allowedTypes: ['pdf', 'png'] },
        ],
        forms: [],
      },
      {
        key: 'impl',
        name: 'التنفيذ',
        order: 2,
        weight: 50,
        dueDate: new Date(now + 30 * 86400000).toISOString(),
        requiredDeliverables: [
          { key: 'prototype', title: 'النموذج الأولي', allowedTypes: ['pdf', 'zip'] },
        ],
        forms: [],
      },
      {
        key: 'closure',
        name: 'الإغلاق والتسليم النهائي',
        order: 3,
        weight: 30,
        dueDate: new Date(now + 60 * 86400000).toISOString(),
        requiredDeliverables: [],
        forms: [],
      },
    ],
    ...overrides,
  };
}

describe('Tracking Integration (P3 / US3)', () => {
  let app;
  let collegeA;
  let deptA1;
  let users;
  let tokens;

  async function loginAs(email, password) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
  }

  async function createApprovedProject({ createTemplateFirst = true } = {}) {
    if (createTemplateFirst) {
      const tplRes = await request(app)
        .post(`/api/v1/colleges/${collegeA._id}/phase-templates`)
        .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
        .send(buildTemplatePayload());
      expect(tplRes.status).toBe(201);
    }

    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        title: 'نظام متابعة المراحل والمخرجات الذكي',
        idea: 'تطوير منصة متكاملة لإدارة مشاريع التخرج ومتابعة الإنجاز.',
        problem: 'صعوبة متابعة التسليمات والمكونات والميزانية.',
        objectives: ['إدارة المراحل', 'تتبع التسليمات'],
        scope: 'كلية الهندسة',
        field: 'software_engineering',
        type: 'hybrid',
        beneficiaries: 'طلاب ومشرفو التخرج',
        keywords: ['متابعة', 'مخرجات'],
        expectedOutcomes: 'نظام عملي متكامل',
      });
    expect(createRes.status).toBe(201);
    const projectId = createRes.body.data.id;

    await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ reviewerId: String(users.supA1._id) });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ event: 'SUBMIT' });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'START_REVIEW' });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ event: 'RECOMMEND', comment: 'ممتاز ومناسب' });

    const approveRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ event: 'APPROVE' });

    return { projectId, approveRes };
  }

  beforeEach(async () => {
    vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
    app = createApp();

    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    collegeA = await College.create({
      name: 'كلية الهندسة',
      code: 'ENG',
      settings: { teamSizeMin: 1, teamSizeMax: 4, allowCrossCollege: false, supervisorPrimaryCap: 5 },
    });
    deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });

    const now = Date.now();
    await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * 86400000),
      endDate: new Date(now + 200 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 5 * 86400000),
        registrationClosesAt: new Date(now + 20 * 86400000),
        proposalDeadline: new Date(now + 30 * 86400000),
      },
    });

    const password = 'Password123';
    const passwordHash = await hashPassword(password);
    const createUser = (doc) =>
      User.create({ passwordHash, status: USER_STATUSES.ACTIVE, ...doc });

    const collegeAdminA = await createUser({
      name: 'عميد الهندسة',
      email: 'ca@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const deptAdminA1 = await createUser({
      name: 'رئيس قسم الحاسبات',
      email: 'da@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const supA1 = await createUser({
      name: 'د. المشرف الأساسي',
      email: 'sup@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const studentA1 = await createUser({
      name: 'سارة الطالبة',
      email: 's1@mnu.edu.eg',
      studentId: '2026101',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });

    users = { collegeAdminA, deptAdminA1, supA1, studentA1 };
    tokens = {
      collegeAdminA: await loginAs('ca@mnu.edu.eg', password),
      deptAdminA1: await loginAs('da@mnu.edu.eg', password),
      supA1: await loginAs('sup@mnu.edu.eg', password),
      studentA1: await loginAs('s1@mnu.edu.eg', password),
    };
  });

  it('rejects phase template when weights do not sum to 100 and isolates project copies from later template edits', async () => {
    const badRes = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/phase-templates`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send(
        buildTemplatePayload({
          phases: [
            { key: 'p1', name: 'مرحلة ١', order: 1, weight: 40, dueOffsetDays: 30, requiredDeliverables: [] },
            { key: 'p2', name: 'مرحلة ٢', order: 2, weight: 40, dueOffsetDays: 60, requiredDeliverables: [] },
          ],
        })
      );
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('VALIDATION_ERROR');

    // Upload a downloadable form for the template
    const formFile = await signAndBuildUploadResult(app, tokens.collegeAdminA, {
      purpose: 'form',
      fileName: 'nmozag.pdf',
      mimeType: 'application/pdf',
      bytes: 12000,
    });
    const payload = buildTemplatePayload();
    payload.phases[0].forms = [formFile];

    const createdTpl = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/phase-templates`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send(payload);
    expect(createdTpl.status).toBe(201);
    const templateId = createdTpl.body.data.id;

    // Approve project -> copies template phases
    const { projectId, approveRes } = await createApprovedProject({ createTemplateFirst: false });
    expect(approveRes.status).toBe(200);

    // Edit template afterward -> existing project copy stays unchanged
    const patchTpl = await request(app)
      .patch(`/api/v1/phase-templates/${templateId}`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send({ name: 'قالب محدث' });
    expect(patchTpl.status).toBe(200);

    const phasesRes = await request(app)
      .get(`/api/v1/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(phasesRes.status).toBe(200);
    expect(phasesRes.body.data.phases).toHaveLength(3);
    expect(phasesRes.body.data.phases[0].forms).toHaveLength(1);
    expect(phasesRes.body.data.phases[0].deliverables).toHaveLength(2);
  });

  it('blocks project approval with NO_ACTIVE_PHASE_TEMPLATE when college has no active template', async () => {
    const { approveRes } = await createApprovedProject({ createTemplateFirst: false });
    expect(approveRes.status).toBe(409);
    expect(approveRes.body.error.code).toBe('NO_ACTIVE_PHASE_TEMPLATE');
  });

  it('handles versioned submissions (v1/v2), late flags, disallowed/tampered uploads, supervisor review, progress %, and revocation blocking once defense scheduled', async () => {
    const { projectId, approveRes } = await createApprovedProject();
    expect(approveRes.status).toBe(200);

    // Assign primary supervisor for supervisor-gated actions
    const assignSup = await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ primaryId: String(users.supA1._id) });
    expect(assignSup.status).toBe(200);

    // Oversized or disallowed upload signing rejected
    const badSign = await request(app)
      .post('/api/v1/uploads/sign')
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        purpose: 'deliverable',
        projectId,
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload',
        bytes: 5000,
      });
    expect(badSign.status).toBe(400);
    expect(badSign.body.error.code).toBe('UPLOAD_INVALID');

    const phasesRes = await request(app)
      .get(`/api/v1/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    const phase1 = phasesRes.body.data.phases[0];
    const phase3 = phasesRes.body.data.phases[2]; // 0 required deliverables, weight 30
    const deliv1 = phase1.deliverables[0];

    // Tampered upload signature rejected
    const tamperedSubmit = await request(app)
      .post(`/api/v1/projects/${projectId}/deliverables/${deliv1.id}/submissions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        files: [
          {
            public_id: `spp/projects/${projectId}/deliverable/fake`,
            version: 1,
            signature: 'invalid',
            resource_type: 'image',
            type: 'authenticated',
            format: 'pdf',
            bytes: 1000,
            secure_url: 'https://res.cloudinary.com/x/image/authenticated/v1/fake.pdf',
            original_filename: 'fake',
          },
        ],
        links: [],
      });
    expect(tamperedSubmit.status).toBe(400);
    expect(tamperedSubmit.body.error.code).toBe('UPLOAD_INVALID');

    // Supervisor moves phase1 dueDate into the past so next submission is late
    const pastDue = new Date(Date.now() - 86400000).toISOString();
    const adjustRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/phases/${phase1.id}`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ dueDate: pastDue });
    expect(adjustRes.status).toBe(200);

    // Submit v1 (late) with link
    const sub1Res = await request(app)
      .post(`/api/v1/projects/${projectId}/deliverables/${deliv1.id}/submissions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        files: [],
        links: [{ kind: 'github', url: 'https://github.com/mnu/spp-srs', title: 'مستودع المتطلبات' }],
        note: 'النسخة الأولى',
      });
    expect(sub1Res.status).toBe(201);
    expect(sub1Res.body.data.version).toBe(1);
    expect(sub1Res.body.data.isLate).toBe(true);

    // Submit v2 with verified Cloudinary file -> retains v1 and marks v2 latest
    const validUpload = await signAndBuildUploadResult(app, tokens.studentA1, {
      purpose: 'deliverable',
      projectId,
      fileName: 'srs-v2.pdf',
      mimeType: 'application/pdf',
      bytes: 20480,
    });
    const sub2Res = await request(app)
      .post(`/api/v1/projects/${projectId}/deliverables/${deliv1.id}/submissions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        files: [validUpload],
        links: [{ kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'فيديو توضيحي' }],
        note: 'النسخة الثانية المحدثة',
      });
    expect(sub2Res.status).toBe(201);
    expect(sub2Res.body.data.version).toBe(2);

    const listSubsRes = await request(app)
      .get(`/api/v1/projects/${projectId}/deliverables/${deliv1.id}/submissions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(listSubsRes.status).toBe(200);
    expect(listSubsRes.body.data).toHaveLength(2);
    expect(listSubsRes.body.data[0].version).toBe(2);
    expect(listSubsRes.body.data[0].files[0].signedUrl).toContain('https://');

    // Supervisor approves v2 -> 1 of 2 required deliverables in 20% phase => +10%
    const reviewRes = await request(app)
      .post(`/api/v1/submissions/${sub2Res.body.data.id}/review`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ decision: 'approved', comment: 'ممتاز ومكتمل' });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.progress.percent).toBe(10);

    // Cannot submit v3 while approved
    const blockedRes = await request(app)
      .post(`/api/v1/projects/${projectId}/deliverables/${deliv1.id}/submissions`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({
        files: [],
        links: [{ kind: 'github', url: 'https://github.com/mnu/spp-srs-3' }],
      });
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.error.code).toBe('DELIVERABLE_ALREADY_APPROVED');

    // Zero-deliverable phase completion adds +30% -> 40%
    const completePhase3 = await request(app)
      .post(`/api/v1/projects/${projectId}/phases/${phase3.id}/complete`)
      .set('Authorization', `Bearer ${tokens.supA1}`);
    expect(completePhase3.status).toBe(200);
    expect(completePhase3.body.data.progress.percent).toBe(40);

    // Reopen zero-deliverable phase -> drops back to 10%
    const reopenPhase3 = await request(app)
      .post(`/api/v1/projects/${projectId}/phases/${phase3.id}/reopen`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ reason: 'يحتاج مراجعة إضافية' });
    expect(reopenPhase3.status).toBe(200);
    expect(reopenPhase3.body.data.progress.percent).toBe(10);

    // Revoking deliverable approval writes audit log and drops progress to 0%
    const revokeRes = await request(app)
      .post(`/api/v1/submissions/${sub2Res.body.data.id}/review`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ decision: 'changes_requested', comment: 'يرجى تحديث المخطط' });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.progress.percent).toBe(0);

    const revokeAudit = await AuditLog.findOne({
      action: 'submission.revoke_approval',
      'scope.projectId': projectId,
    });
    expect(revokeAudit).not.toBeNull();

    // Re-approve, then simulate defenseState = 'scheduled' -> revocation is blocked
    await request(app)
      .post(`/api/v1/submissions/${sub2Res.body.data.id}/review`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ decision: 'approved' });
    await Project.updateOne({ _id: projectId }, { $set: { defenseState: 'scheduled' } });

    const blockedRevoke = await request(app)
      .post(`/api/v1/submissions/${sub2Res.body.data.id}/review`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ decision: 'changes_requested', comment: 'تعديل متأخر' });
    expect(blockedRevoke.status).toBe(409);
    expect(blockedRevoke.body.error.code).toBe('DEFENSE_ALREADY_SCHEDULED');
  });

  it('supports Kanban tasks, BOM auto-budget, tools, meetings action-item-to-task, statusFlag, and timeline', async () => {
    const { projectId } = await createApprovedProject();
    const assignSup = await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdminA1}`)
      .send({ primaryId: String(users.supA1._id) });
    expect(assignSup.status).toBe(200);

    // BOM items -> updates project.budgetEstimate
    const bom1 = await request(app)
      .post(`/api/v1/projects/${projectId}/bom`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ item: 'حساس حرارة DHT22', quantity: 3, unitPrice: 150, supplier: 'رام للالكترونيات', status: 'needed' });
    expect(bom1.status).toBe(201);
    expect(bom1.body.data.budgetEstimate).toBe(450);

    const bom2 = await request(app)
      .post(`/api/v1/projects/${projectId}/bom`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ item: 'لوحة ESP32', quantity: 2, unitPrice: 300, status: 'ordered' });
    expect(bom2.status).toBe(201);
    expect(bom2.body.data.budgetEstimate).toBe(1050);

    const patchBom = await request(app)
      .patch(`/api/v1/bom/${bom1.body.data.item.id}`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ quantity: 4, status: 'received' });
    expect(patchBom.status).toBe(200);
    expect(patchBom.body.data.budgetEstimate).toBe(1200);

    // Tools
    const toolRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tools`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ category: 'framework', name: 'React', version: '18.3' });
    expect(toolRes.status).toBe(201);

    // Kanban tasks
    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ title: 'تهيئة لوحة الأردوينو', column: 'todo', assigneeIds: [String(users.studentA1._id)] });
    expect(taskRes.status).toBe(201);

    const moveTask = await request(app)
      .patch(`/api/v1/tasks/${taskRes.body.data.id}`)
      .set('Authorization', `Bearer ${tokens.studentA1}`)
      .send({ column: 'done', order: 'a0' });
    expect(moveTask.status).toBe(200);
    expect(moveTask.body.data.column).toBe('done');

    // Progress remains 0 (Kanban tasks never affect completion %)
    const projRes = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(projRes.body.data.progress.percent).toBe(0);
    expect(projRes.body.data.budgetEstimate).toBe(1200);

    // Meeting + action item conversion to Kanban task
    const meetRes = await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({
        date: new Date().toISOString(),
        attendeeIds: [String(users.supA1._id), String(users.studentA1._id)],
        notes: 'مراجعة التصميم المعماري للنظام',
        actionItems: [{ text: 'تحديث مخطط العلاقات', assigneeId: String(users.studentA1._id) }],
      });
    expect(meetRes.status).toBe(201);

    const convRes = await request(app)
      .post(`/api/v1/meetings/${meetRes.body.data.id}/action-items/0/to-task`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(convRes.status).toBe(201);
    expect(convRes.body.data.title).toBe('تحديث مخطط العلاقات');
    expect(convRes.body.data.sourceMeetingId).toBe(meetRes.body.data.id);

    // Status flag & timeline
    const flagRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/status-flag`)
      .set('Authorization', `Bearer ${tokens.supA1}`)
      .send({ statusFlag: 'at_risk' });
    expect(flagRes.status).toBe(200);
    expect(flagRes.body.data.statusFlag).toBe('at_risk');

    const timelineRes = await request(app)
      .get(`/api/v1/projects/${projectId}/timeline`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('sends idempotent 3d, 1d, and 0d deliverable deadline reminders', async () => {
    const now = new Date('2026-11-23T08:00:00.000Z');
    const tplRes = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/phase-templates`)
      .set('Authorization', `Bearer ${tokens.collegeAdminA}`)
      .send({
        name: 'قالب التذكير',
        isDefault: true,
        phases: [
          {
            key: 'p1',
            name: 'مرحلة التذكير',
            order: 1,
            weight: 100,
            dueDate: new Date('2026-11-26T08:00:00.000Z').toISOString(),
            requiredDeliverables: [{ key: 'd1', title: 'التقرير الأول' }],
          },
        ],
      });
    expect(tplRes.status).toBe(201);

    const { projectId } = await createApprovedProject({ createTemplateFirst: false });
    const phasesRes = await request(app)
      .get(`/api/v1/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${tokens.studentA1}`);
    const deliv = phasesRes.body.data.phases[0].deliverables[0];

    // 3 days before due date
    await runDeadlineReminders(now);
    let count = await Notification.countDocuments({ userId: users.studentA1._id, type: 'deadline_reminder' });
    expect(count).toBe(1);

    // Running again same day is idempotent
    await runDeadlineReminders(now);
    count = await Notification.countDocuments({ userId: users.studentA1._id, type: 'deadline_reminder' });
    expect(count).toBe(1);

    // 1 day before due date
    await runDeadlineReminders(new Date('2026-11-25T08:00:00.000Z'));
    count = await Notification.countDocuments({ userId: users.studentA1._id, type: 'deadline_reminder' });
    expect(count).toBe(2);

    // Due date (0 days)
    await runDeadlineReminders(new Date('2026-11-26T08:00:00.000Z'));
    count = await Notification.countDocuments({ userId: users.studentA1._id, type: 'deadline_reminder' });
    expect(count).toBe(3);

    // Sanity check deliverable reference
    expect(deliv.title).toBe('التقرير الأول');
  });
});
