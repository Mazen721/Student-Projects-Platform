import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROPOSAL_STATUSES, ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';
import ProjectPhase from '../../src/modules/tracking/projectPhase.model.js';
import Deliverable from '../../src/modules/tracking/deliverable.model.js';
import Submission from '../../src/modules/tracking/submission.model.js';
import Task from '../../src/modules/tracking/task.model.js';
import BOMItem from '../../src/modules/tracking/bomItem.model.js';
import Meeting from '../../src/modules/tracking/meeting.model.js';

describe('P3 Authorization Matrix (Tracking)', () => {
  let app;
  let tokens;
  let resources;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    const collegeA = await College.create({ name: 'كلية الهندسة', code: 'ENG' });
    const collegeB = await College.create({ name: 'كلية الحاسبات', code: 'CS' });
    const deptA = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    const deptB = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    const now = Date.now();
    const ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * 86400000),
      endDate: new Date(now + 200 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 5 * 86400000),
        registrationClosesAt: new Date(now + 15 * 86400000),
        proposalDeadline: new Date(now + 25 * 86400000),
      },
    });

    const pw = await hashPassword('Password123');
    const createU = (doc) => User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const collegeAdminA = await createU({
      name: 'عميد أ',
      email: 'ca@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const collegeAdminB = await createU({
      name: 'عميد ب',
      email: 'cb@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeB._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeB._id, collegeId: collegeB._id }],
    });
    const deptAdminA = await createU({
      name: 'رئيس قسم أ',
      email: 'da@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const primarySup = await createU({
      name: 'مشرف أساسي',
      email: 'sup1@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const coSup = await createU({
      name: 'مشرف مشارك',
      email: 'cosup@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const studentTeam = await createU({
      name: 'طالب الفريق',
      email: 'st1@mnu.edu.eg',
      studentId: '2026501',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const outsiderStudent = await createU({
      name: 'طالب خارجي',
      email: 'st2@mnu.edu.eg',
      studentId: '2026502',
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB._id, collegeId: collegeB._id, departmentId: deptB._id }],
    });

    tokens = {
      collegeAdminA: signAccessToken(collegeAdminA),
      collegeAdminB: signAccessToken(collegeAdminB),
      deptAdminA: signAccessToken(deptAdminA),
      primarySup: signAccessToken(primarySup),
      coSup: signAccessToken(coSup),
      studentTeam: signAccessToken(studentTeam),
      outsiderStudent: signAccessToken(outsiderStudent),
    };

    const template = await PhaseTemplate.create({
      collegeId: collegeA._id,
      name: 'قالب أ',
      isDefault: true,
      phases: [{ key: 'p1', name: 'مرحلة ١', order: 1, weight: 100, dueOffsetDays: 30, requiredDeliverables: [] }],
    });

    const project = await Project.create({
      title: 'مشروع اختبار صلاحيات المتابعة',
      slug: 'tracking-authz-project',
      idea: 'فكرة اختبار الصلاحيات للمتابعة',
      problem: 'وصف المشكلة',
      scope: 'نطاق المشروع',
      field: 'ai',
      type: 'software',
      beneficiaries: 'الطلاب',
      expectedOutcomes: 'نموذج اختباري',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      status: PROPOSAL_STATUSES.APPROVED,
      team: {
        leaderId: studentTeam._id,
        members: [{ userId: studentTeam._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [studentTeam._id],
      supervision: {
        primaryId: primarySup._id,
        coSupervisorIds: [coSup._id],
      },
    });

    const phase = await ProjectPhase.create({
      projectId: project._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      templateId: template._id,
      key: 'p1',
      name: 'مرحلة ١',
      order: 1,
      weight: 100,
      dueDate: new Date('2027-01-01'),
      requiredCount: 0,
    });

    const deliverable = await Deliverable.create({
      projectId: project._id,
      phaseId: phase._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      key: 'd1',
      title: 'مخرج ١',
      required: false,
      dueDate: new Date('2027-01-01'),
    });

    const submission = await Submission.create({
      deliverableId: deliverable._id,
      projectId: project._id,
      collegeId: collegeA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      version: 1,
      isLatest: true,
      links: [{ kind: 'github', url: 'https://github.com/mnu/test' }],
      submittedBy: studentTeam._id,
      submittedAt: new Date(),
      isLate: false,
    });

    const task = await Task.create({
      projectId: project._id,
      title: 'مهمة أولى',
      column: 'todo',
      order: 'a0',
      createdBy: studentTeam._id,
    });

    const bomItem = await BOMItem.create({
      projectId: project._id,
      collegeId: collegeA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      item: 'مكون اختباري',
      quantity: 1,
      unitPrice: 50,
    });

    const meeting = await Meeting.create({
      projectId: project._id,
      date: new Date(),
      attendeeIds: [studentTeam._id],
      notes: 'ملاحظات اجتماع',
      actionItems: [{ text: 'بند عمل ١', assigneeId: studentTeam._id }],
      createdBy: studentTeam._id,
    });

    resources = {
      collegeAId: String(collegeA._id),
      attendeeId: String(studentTeam._id),
      templateId: String(template._id),
      projectId: String(project._id),
      phaseId: String(phase._id),
      deliverableId: String(deliverable._id),
      submissionId: String(submission._id),
      taskId: String(task._id),
      bomItemId: String(bomItem._id),
      meetingId: String(meeting._id),
    };
  });

  const matrix = [
    {
      name: 'phaseTemplate.list',
      method: 'get',
      url: () => `/api/v1/colleges/${resources.collegeAId}/phase-templates`,
      allow: 'collegeAdminA',
      deny: 'collegeAdminB',
    },
    {
      name: 'phaseTemplate.create',
      method: 'post',
      url: () => `/api/v1/colleges/${resources.collegeAId}/phase-templates`,
      body: {
        name: 'قالب جديد',
        phases: [{ key: 'p1', name: 'مرحلة', order: 1, weight: 100, dueOffsetDays: 15, requiredDeliverables: [] }],
      },
      allow: 'collegeAdminA',
      deny: 'collegeAdminB',
    },
    {
      name: 'phaseTemplate.update',
      method: 'patch',
      url: () => `/api/v1/phase-templates/${resources.templateId}`,
      body: { name: 'قالب معدل' },
      allow: 'collegeAdminA',
      deny: 'collegeAdminB',
    },
    {
      name: 'phase.adjust',
      method: 'patch',
      url: () => `/api/v1/projects/${resources.projectId}/phases/${resources.phaseId}`,
      body: { dueDate: '2027-02-01T00:00:00.000Z' },
      allow: 'primarySup',
      deny: 'coSup',
    },
    {
      name: 'phase.markComplete',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/phases/${resources.phaseId}/complete`,
      allow: 'primarySup',
      deny: 'studentTeam',
    },
    {
      name: 'submission.create',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/deliverables/${resources.deliverableId}/submissions`,
      body: { files: [], links: [{ kind: 'github', url: 'https://github.com/mnu/x' }] },
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
    {
      name: 'submission.review',
      method: 'post',
      url: () => `/api/v1/submissions/${resources.submissionId}/review`,
      body: { decision: 'approved' },
      allow: 'primarySup',
      deny: 'coSup',
    },
    {
      name: 'project.setStatusFlag',
      method: 'patch',
      url: () => `/api/v1/projects/${resources.projectId}/status-flag`,
      body: { statusFlag: 'at_risk' },
      allow: 'primarySup',
      deny: 'studentTeam',
    },
    {
      name: 'task.list',
      method: 'get',
      url: () => `/api/v1/projects/${resources.projectId}/tasks`,
      allow: 'deptAdminA',
      deny: 'outsiderStudent',
    },
    {
      name: 'task.create',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/tasks`,
      body: { title: 'مهمة جديدة', column: 'todo' },
      allow: 'studentTeam',
      deny: 'primarySup',
    },
    {
      name: 'task.update',
      method: 'patch',
      url: () => `/api/v1/tasks/${resources.taskId}`,
      body: { column: 'in_progress' },
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
    {
      name: 'task.delete',
      method: 'delete',
      url: () => `/api/v1/tasks/${resources.taskId}`,
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
    {
      name: 'bom.read',
      method: 'get',
      url: () => `/api/v1/projects/${resources.projectId}/bom`,
      allow: 'coSup',
      deny: 'outsiderStudent',
    },
    {
      name: 'bom.write (project)',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/bom`,
      body: { item: 'مقاومة', quantity: 5, unitPrice: 2 },
      allow: 'studentTeam',
      deny: 'primarySup',
    },
    {
      name: 'bom.write (item)',
      method: 'patch',
      url: () => `/api/v1/bom/${resources.bomItemId}`,
      body: { quantity: 2 },
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
    {
      name: 'tools.read',
      method: 'get',
      url: () => `/api/v1/projects/${resources.projectId}/tools`,
      allow: 'deptAdminA',
      deny: 'outsiderStudent',
    },
    {
      name: 'tools.write',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/tools`,
      body: { category: 'language', name: 'JavaScript' },
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
    {
      name: 'meeting.read',
      method: 'get',
      url: () => `/api/v1/projects/${resources.projectId}/meetings`,
      allow: 'deptAdminA',
      deny: 'outsiderStudent',
    },
    {
      name: 'meeting.write',
      method: 'post',
      url: () => `/api/v1/projects/${resources.projectId}/meetings`,
      body: () => ({ date: '2026-12-01T10:00:00.000Z', attendeeIds: [resources.attendeeId], notes: 'اجتماع متابعة', actionItems: [] }),
      allow: 'primarySup',
      deny: 'outsiderStudent',
    },
    {
      name: 'task.create (meeting action item)',
      method: 'post',
      url: () => `/api/v1/meetings/${resources.meetingId}/action-items/0/to-task`,
      allow: 'studentTeam',
      deny: 'outsiderStudent',
    },
  ];

  it.each(matrix)('$name: allows in-scope actor and returns 404 for out-of-scope actor', async ({ method, url, body, allow, deny }) => {
    const payload = typeof body === 'function' ? body() : body;
    const reqAllow = request(app)[method](url()).set('Authorization', `Bearer ${tokens[allow]}`);
    const resAllow = payload ? await reqAllow.send(payload) : await reqAllow;
    expect(resAllow.status).toBeLessThan(400);

    const reqDeny = request(app)[method](url()).set('Authorization', `Bearer ${tokens[deny]}`);
    const resDeny = payload ? await reqDeny.send(payload) : await reqDeny;
    expect(resDeny.status).toBe(404);
    expect(resDeny.body.error.code).toBe('NOT_FOUND');
  });
});
