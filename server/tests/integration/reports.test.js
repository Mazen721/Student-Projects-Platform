import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  DELIVERABLE_STATUSES,
  GRADE_BANDS,
  PROPOSAL_STATUSES,
  ROLES,
  SCOPE_TYPES,
  SHOWCASE_STATES,
  STATUS_FLAGS,
  USER_STATUSES,
} from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import { runCleanupJob } from '../../src/jobs/cleanup.js';
import { runRecalcStatsJob } from '../../src/jobs/recalcStats.js';
import User from '../../src/modules/auth/user.model.js';
import Defense from '../../src/modules/evaluation/defense.model.js';
import Grade from '../../src/modules/evaluation/grade.model.js';
import Rubric from '../../src/modules/evaluation/rubric.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import StatsCache from '../../src/modules/reports/statsCache.model.js';
import ContactRequest from '../../src/modules/showcase/contactRequest.model.js';
import ShowcasePage from '../../src/modules/showcase/showcasePage.model.js';
import Deliverable from '../../src/modules/tracking/deliverable.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';
import ProjectPhase from '../../src/modules/tracking/projectPhase.model.js';
import Submission from '../../src/modules/tracking/submission.model.js';
import ToolItem from '../../src/modules/tracking/toolItem.model.js';

const DAY = 24 * 60 * 60 * 1000;

async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const texts = [];
  sheet.eachRow((row) => {
    texts.push(row.values.filter((v) => v !== null && v !== undefined).map(String));
  });
  return { workbook, sheet, flatText: texts.flat().join(' ') };
}

describe('P7 Dashboards, Reports, Aggregations & Exports Integration', () => {
  let app;
  let tokens;
  let ids;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    const collegeEng = await College.create({
      name: 'كلية الهندسة',
      code: 'ENG',
      settings: { supervisorPrimaryCap: 2, passMark: 60 },
    });
    const collegeCs = await College.create({
      name: 'كلية الحاسبات',
      code: 'CS',
      settings: { supervisorPrimaryCap: 2, passMark: 50 },
    });
    const deptCe = await Department.create({
      name: 'هندسة الحاسبات',
      code: 'CE',
      collegeId: collegeEng._id,
    });
    const deptCs = await Department.create({
      name: 'علوم الحاسب',
      code: 'CS1',
      collegeId: collegeCs._id,
    });

    const now = Date.now();
    const makeAy = (collegeId, label, isCurrent, offsetDays) =>
      AcademicYear.create({
        collegeId,
        label,
        isCurrent,
        startDate: new Date(now - (offsetDays + 180) * DAY),
        endDate: new Date(now - offsetDays * DAY + 180 * DAY),
        cycle: {
          registrationOpensAt: new Date(now - offsetDays * DAY - 10 * DAY),
          registrationClosesAt: new Date(now - offsetDays * DAY + 20 * DAY),
          proposalDeadline: new Date(now - offsetDays * DAY + 25 * DAY),
        },
      });

    const ayEng26 = await makeAy(collegeEng._id, '2026/2027', true, 0);
    const ayEng25 = await makeAy(collegeEng._id, '2025/2026', false, 365);
    const ayCs26 = await makeAy(collegeCs._id, '2026/2027', true, 0);

    const pw = await hashPassword('Password123');
    const makeUser = (doc) =>
      User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const uniAdmin = await makeUser({
      name: 'مدير الجامعة',
      email: 'uni@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });
    const engAdmin = await makeUser({
      name: 'عميد الهندسة',
      email: 'eng-admin@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeEng._id,
      roles: [
        {
          role: ROLES.COLLEGE_ADMIN,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeEng._id,
          collegeId: collegeEng._id,
        },
      ],
    });
    const sup1 = await makeUser({
      name: 'د. أحمد المشرف',
      email: 'sup1@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      roles: [
        {
          role: ROLES.SUPERVISOR,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptCe._id,
          collegeId: collegeEng._id,
          departmentId: deptCe._id,
        },
      ],
    });
    const supDeactivated = await makeUser({
      name: 'د. معطل',
      email: 'sup-off@mnu.edu.eg',
      status: USER_STATUSES.DEACTIVATED,
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      roles: [
        {
          role: ROLES.SUPERVISOR,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptCe._id,
          collegeId: collegeEng._id,
          departmentId: deptCe._id,
        },
      ],
    });
    const st1 = await makeUser({
      name: 'طالب أول',
      email: 'st1@mnu.edu.eg',
      studentId: '2026001',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptCe._id,
          collegeId: collegeEng._id,
          departmentId: deptCe._id,
        },
      ],
    });
    const st2 = await makeUser({
      name: 'طالب ثانٍ',
      email: 'st2@mnu.edu.eg',
      studentId: '2026002',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptCe._id,
          collegeId: collegeEng._id,
          departmentId: deptCe._id,
        },
      ],
    });
    const stCs = await makeUser({
      name: 'طالب حاسبات',
      email: 'stcs@mnu.edu.eg',
      studentId: '2026003',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeCs._id,
      departmentId: deptCs._id,
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptCs._id,
          collegeId: collegeCs._id,
          departmentId: deptCs._id,
        },
      ],
    });
    const investor = await makeUser({
      name: 'مستثمر',
      email: 'inv@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.INVESTOR,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });

    const baseProj = {
      idea: 'فكرة مشروع متكامل',
      problem: 'وصف المشكلة',
      scope: 'نطاق العمل',
      type: 'hybrid',
      beneficiaries: 'الطلاب والمجتمع',
      expectedOutcomes: 'نظام متكامل',
    };

    const projEng1 = await Project.create({
      ...baseProj,
      title: 'منصة الطاقة الذكية',
      slug: 'smart-energy',
      field: 'ai',
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      status: PROPOSAL_STATUSES.APPROVED,
      progress: { percent: 80, perPhase: [] },
      statusFlag: STATUS_FLAGS.ON_TRACK,
      budgetEstimate: 1500,
      isPublished: true,
      showcaseStats: { validVotes: 12, views7d: 40, follows: 3, bookmarks: 5 },
      team: { leaderId: st1._id, members: [{ userId: st1._id, role: 'leader' }] },
      activeMemberIds: [st1._id],
      supervision: { primaryId: sup1._id },
    });

    const projEng2 = await Project.create({
      ...baseProj,
      title: 'روبوت الفرز الآلي',
      slug: 'sorting-robot',
      field: 'robotics',
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      status: PROPOSAL_STATUSES.APPROVED,
      progress: { percent: 40, perPhase: [] },
      statusFlag: STATUS_FLAGS.DELAYED,
      budgetEstimate: 0,
      team: { leaderId: st2._id, members: [{ userId: st2._id, role: 'leader' }] },
      activeMemberIds: [st2._id],
      supervision: { primaryId: supDeactivated._id, coSupervisorIds: [sup1._id] },
    });

    await Project.create({
      ...baseProj,
      title: 'مسودة مقترح جديد',
      slug: 'draft-proposal',
      field: 'ai',
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      status: PROPOSAL_STATUSES.DRAFT,
      team: { leaderId: st1._id, members: [{ userId: st1._id, role: 'leader' }] },
      activeMemberIds: [st1._id],
    });

    const projEngPrev = await Project.create({
      ...baseProj,
      title: 'مشروع العام السابق',
      slug: 'prev-year-eng',
      field: 'ai',
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng25._id,
      academicYearLabel: '2025/2026',
      status: PROPOSAL_STATUSES.ARCHIVED,
      progress: { percent: 100, perPhase: [] },
      statusFlag: STATUS_FLAGS.ON_TRACK,
      budgetEstimate: 1000,
      team: { leaderId: st1._id, members: [{ userId: st1._id, role: 'leader' }] },
      activeMemberIds: [st1._id],
      supervision: { primaryId: sup1._id },
    });

    const projCs1 = await Project.create({
      ...baseProj,
      title: 'محرك تحليل البيانات',
      slug: 'data-engine',
      field: 'data_science',
      collegeId: collegeCs._id,
      departmentId: deptCs._id,
      academicYearId: ayCs26._id,
      academicYearLabel: '2026/2027',
      status: PROPOSAL_STATUSES.APPROVED,
      progress: { percent: 60, perPhase: [] },
      statusFlag: STATUS_FLAGS.AT_RISK,
      budgetEstimate: 2500,
      team: { leaderId: stCs._id, members: [{ userId: stCs._id, role: 'leader' }] },
      activeMemberIds: [stCs._id],
      supervision: {},
    });

    const templateEng = await PhaseTemplate.create({
      collegeId: collegeEng._id,
      name: 'قالب الهندسة',
      phases: [
        { key: 'analysis', name: 'التحليل', order: 1, weight: 50, dueOffsetDays: 30 },
        { key: 'impl', name: 'التنفيذ', order: 2, weight: 50, dueOffsetDays: 60 },
      ],
    });

    const phase1 = await ProjectPhase.create({
      projectId: projEng1._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      templateId: templateEng._id,
      key: 'analysis',
      name: 'التحليل',
      order: 1,
      weight: 50,
      dueDate: new Date(now + 20 * DAY),
      requiredCount: 1,
    });
    const phase2 = await ProjectPhase.create({
      projectId: projEng2._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      templateId: templateEng._id,
      key: 'analysis',
      name: 'التحليل',
      order: 1,
      weight: 50,
      dueDate: new Date(now + 20 * DAY),
      requiredCount: 1,
    });

    const deliv1 = await Deliverable.create({
      phaseId: phase1._id,
      projectId: projEng1._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      key: 'srs',
      title: 'وثيقة المتطلبات',
      required: true,
      dueDate: new Date(now + 10 * DAY),
      latestStatus: DELIVERABLE_STATUSES.APPROVED,
    });
    const deliv2 = await Deliverable.create({
      phaseId: phase2._id,
      projectId: projEng2._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      key: 'design',
      title: 'التصميم المبدئي',
      required: true,
      dueDate: new Date(now - 5 * DAY),
      latestStatus: DELIVERABLE_STATUSES.SUBMITTED,
    });

    await Submission.create({
      deliverableId: deliv1._id,
      projectId: projEng1._id,
      collegeId: collegeEng._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      version: 1,
      isLatest: true,
      isLate: false,
      submittedBy: st1._id,
    });
    await Submission.create({
      deliverableId: deliv2._id,
      projectId: projEng2._id,
      collegeId: collegeEng._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      version: 1,
      isLatest: true,
      isLate: true,
      submittedBy: st2._id,
    });

    await ToolItem.create({
      projectId: projEng1._id,
      collegeId: collegeEng._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      category: 'framework',
      name: 'React',
    });
    await ToolItem.create({
      projectId: projEng2._id,
      collegeId: collegeEng._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      category: 'library',
      name: 'TensorFlow',
    });

    await ShowcasePage.create({
      projectId: projEng1._id,
      slug: projEng1.slug,
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
    });

    await ContactRequest.create({
      projectId: projEng1._id,
      investorId: investor._id,
      message: 'استثمار مبدئي',
      state: 'pending',
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
    });

    const rubricEng = await Rubric.create({
      collegeId: collegeEng._id,
      academicYearId: ayEng26._id,
      name: 'نموذج تقييم',
      supervisorPct: 40,
      committeePct: 60,
      criteria: [{ key: 'c1', name: 'الجودة', appliesTo: 'team', weight: 100 }],
      status: 'locked',
    });
    const fakeCommitteeId = new (await import('mongoose')).default.Types.ObjectId();
    const defenseEng1 = await Defense.create({
      projectId: projEng1._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      rubricId: rubricEng._id,
      committeeId: fakeCommitteeId,
      scheduledAt: new Date(now - 2 * DAY),
      room: 'A1',
      examinerIds: [sup1._id],
      chairId: sup1._id,
      state: 'finalized',
    });
    const defenseCs1 = await Defense.create({
      projectId: projCs1._id,
      collegeId: collegeCs._id,
      departmentId: deptCs._id,
      academicYearId: ayCs26._id,
      academicYearLabel: '2026/2027',
      rubricId: rubricEng._id,
      committeeId: fakeCommitteeId,
      scheduledAt: new Date(now - 2 * DAY),
      room: 'B1',
      examinerIds: [sup1._id],
      chairId: sup1._id,
      state: 'finalized',
    });

    await Grade.create({
      projectId: projEng1._id,
      studentId: st1._id,
      defenseId: defenseEng1._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng26._id,
      academicYearLabel: '2026/2027',
      version: 1,
      isLatest: true,
      supervisorTotal: 90,
      committeeAvg: 88,
      final: 88.8,
      teamGrade: 88.8,
      passed: true,
      band: GRADE_BANDS.EXCELLENT,
      locked: true,
      finalizedAt: new Date(),
      finalizedBy: sup1._id,
    });
    await Grade.create({
      projectId: projEngPrev._id,
      studentId: st1._id,
      defenseId: defenseEng1._id,
      collegeId: collegeEng._id,
      departmentId: deptCe._id,
      academicYearId: ayEng25._id,
      academicYearLabel: '2025/2026',
      version: 1,
      isLatest: true,
      supervisorTotal: 70,
      committeeAvg: 70,
      final: 70,
      teamGrade: 70,
      passed: true,
      band: GRADE_BANDS.GOOD,
      locked: true,
      finalizedAt: new Date(now - 365 * DAY),
      finalizedBy: sup1._id,
    });
    await Grade.create({
      projectId: projCs1._id,
      studentId: stCs._id,
      defenseId: defenseCs1._id,
      collegeId: collegeCs._id,
      departmentId: deptCs._id,
      academicYearId: ayCs26._id,
      academicYearLabel: '2026/2027',
      version: 1,
      isLatest: true,
      supervisorTotal: 55,
      committeeAvg: 55,
      final: 55,
      teamGrade: 55,
      passed: true,
      band: GRADE_BANDS.ACCEPTABLE,
      locked: true,
      finalizedAt: new Date(),
      finalizedBy: sup1._id,
    });

    tokens = {
      uniAdmin: signAccessToken(uniAdmin),
      engAdmin: signAccessToken(engAdmin),
      sup1: signAccessToken(sup1),
    };

    ids = {
      collegeEngId: String(collegeEng._id),
      collegeCsId: String(collegeCs._id),
      deptCeId: String(deptCe._id),
      ayEng26Id: String(ayEng26._id),
      ayEng25Id: String(ayEng25._id),
    };
  });

  it('delivers scoped drill-down dashboards and supervisor personal dashboard', async () => {
    const uniDash = await request(app)
      .get('/api/v1/reports/dashboard')
      .query({ yearLabel: '2026/2027' })
      .set('Authorization', `Bearer ${tokens.uniAdmin}`);
    expect(uniDash.status).toBe(200);
    expect(uniDash.body.scopeType).toBe('university');
    expect(uniDash.body.children).toHaveLength(2);
    expect(uniDash.body.kpis.approvedProjects).toBe(3);

    const engDash = await request(app)
      .get('/api/v1/reports/dashboard')
      .query({ academicYearId: ids.ayEng26Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(engDash.status).toBe(200);
    expect(engDash.body.scopeType).toBe('college');
    expect(engDash.body.children).toHaveLength(1);
    expect(engDash.body.kpis.approvedProjects).toBe(2);

    const supMe = await request(app)
      .get('/api/v1/reports/supervisor/me')
      .query({ yearLabel: '2026/2027' })
      .set('Authorization', `Bearer ${tokens.sup1}`);
    expect(supMe.status).toBe(200);
    expect(supMe.body.primaryProjects).toHaveLength(1);
    expect(supMe.body.coSupervisedProjects).toHaveLength(1);
    expect(supMe.body.mentoredProjects).toHaveLength(0);
    expect(supMe.body.summary.totalProjects).toBe(2);
  });

  it('computes completion, supervisor-distribution (incl. deactivated as unassigned), evaluation (mixed passMarks + YoY), and insights accurately', async () => {
    const completion = await request(app)
      .get('/api/v1/reports/completion')
      .query({ academicYearId: ids.ayEng26Id, compareYearId: ids.ayEng25Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(completion.status).toBe(200);
    expect(completion.body.current.meanPercent).toBe(60);
    expect(completion.body.current.counts).toEqual({ on_track: 1, at_risk: 0, delayed: 1 });
    expect(completion.body.comparison.meanPercent).toBe(100);

    const supDist = await request(app)
      .get('/api/v1/reports/supervisor-distribution')
      .query({ academicYearId: ids.ayEng26Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(supDist.status).toBe(200);
    expect(supDist.body.supervisors).toHaveLength(1);
    expect(supDist.body.supervisors[0]).toMatchObject({
      primary: 1,
      co: 1,
      cap: 2,
      remaining: 1,
      overCap: false,
    });
    expect(supDist.body.unassigned.count).toBe(1);
    expect(supDist.body.unassigned.projects[0].title).toBe('روبوت الفرز الآلي');

    const evalUni = await request(app)
      .get('/api/v1/reports/evaluation')
      .query({ yearLabel: '2026/2027', compareYearLabel: '2025/2026' })
      .set('Authorization', `Bearer ${tokens.uniAdmin}`);
    expect(evalUni.status).toBe(200);
    expect(evalUni.body.current.students).toBe(2);
    expect(evalUni.body.current.passCount).toBe(2);
    expect(evalUni.body.current.bands.excellent).toBe(1);
    expect(evalUni.body.current.bands.acceptable).toBe(1);
    expect(evalUni.body.comparison.mean).toBe(70);

    const insights = await request(app)
      .get('/api/v1/reports/insights')
      .query({ academicYearId: ids.ayEng26Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(insights.status).toBe(200);
    expect(insights.body.budget).toEqual({ total: 1500, mean: 1500, projectsWithBom: 1 });
    expect(insights.body.late).toEqual({ count: 1, percent: 50 });
    expect(insights.body.engagement.validVotes).toBe(12);
    expect(insights.body.engagement.contactRequestsByStatus.pending).toBe(1);
    expect(insights.body.byTechnology.some((item) => item.name === 'React')).toBe(true);
  });

  const exportEndpoints = [
    ['projects', '/api/v1/reports/projects', ['منصة الطاقة الذكية', 'روبوت الفرز الآلي']],
    ['completion', '/api/v1/reports/completion', ['60']],
    ['supervisor-distribution', '/api/v1/reports/supervisor-distribution', ['د. أحمد المشرف', '1']],
    ['evaluation', '/api/v1/reports/evaluation', ['88.8']],
    ['insights', '/api/v1/reports/insights', ['1500', '50', 'React']],
  ];

  it.each(exportEndpoints)(
    '%s: exports Arabic RTL Excel and PDF matching JSON figures with UTF-8 Arabic filename',
    async (_name, path, expectedTokens) => {
      const jsonRes = await request(app)
        .get(path)
        .query({ academicYearId: ids.ayEng26Id })
        .set('Authorization', `Bearer ${tokens.engAdmin}`);
      expect(jsonRes.status).toBe(200);

      const xlsxRes = await request(app)
        .get(path)
        .query({ academicYearId: ids.ayEng26Id, format: 'xlsx' })
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .set('Authorization', `Bearer ${tokens.engAdmin}`);
      expect(xlsxRes.status).toBe(200);
      expect(xlsxRes.headers['content-disposition']).toContain("filename*=UTF-8''");
      const { sheet, flatText } = await parseXlsxBuffer(xlsxRes.body);
      expect(sheet.views[0].rightToLeft).toBe(true);
      for (const token of expectedTokens) {
        expect(flatText).toContain(token);
      }

      const pdfRes = await request(app)
        .get(path)
        .query({ academicYearId: ids.ayEng26Id, format: 'pdf' })
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .set('Authorization', `Bearer ${tokens.engAdmin}`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.headers['content-disposition']).toContain("filename*=UTF-8''");
      expect(pdfRes.body.subarray(0, 4).toString('utf8')).toBe('%PDF');
    }
  );

  it('uses StatsCache within 15 min, supports ?fresh=true recompute, and runs recalcStats/cleanup jobs', async () => {
    const first = await request(app)
      .get('/api/v1/reports/completion')
      .query({ academicYearId: ids.ayEng26Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(first.status).toBe(200);
    expect(first.body.computedAt).toBeTruthy();

    await Project.updateOne({ slug: 'smart-energy' }, { $set: { 'progress.percent': 100 } });

    const cached = await request(app)
      .get('/api/v1/reports/completion')
      .query({ academicYearId: ids.ayEng26Id })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(cached.body.meanPercent).toBe(60);

    const fresh = await request(app)
      .get('/api/v1/reports/completion')
      .query({ academicYearId: ids.ayEng26Id, fresh: 'true' })
      .set('Authorization', `Bearer ${tokens.engAdmin}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.meanPercent).toBe(70);

    const recalcResult = await runRecalcStatsJob();
    expect(recalcResult.updated).toBeGreaterThan(0);

    await StatsCache.create({
      kind: 'completion',
      yearKey: '2010/2011',
      scopeType: 'university',
      scopeId: null,
      data: {},
      computedAt: new Date(Date.now() - 40 * DAY),
    });
    const cleanupResult = await runCleanupJob();
    expect(cleanupResult.removedStatsCaches).toBeGreaterThanOrEqual(1);
  });

  it('executes core report queries via index scans with zero COLLSCAN', async () => {
    const projectExplain = await Project.collection
      .find({ collegeId: (await College.findById(ids.collegeEngId))._id, academicYearId: (await AcademicYear.findById(ids.ayEng26Id))._id, status: 'approved' })
      .explain('executionStats');
    const gradeExplain = await Grade.collection
      .find({ collegeId: (await College.findById(ids.collegeEngId))._id, academicYearId: (await AcademicYear.findById(ids.ayEng26Id))._id, locked: true, isLatest: true })
      .explain('executionStats');

    const stringifyPlan = (exp) => JSON.stringify(exp.queryPlanner?.winningPlan || {});
    expect(stringifyPlan(projectExplain)).toContain('IXSCAN');
    expect(stringifyPlan(projectExplain)).not.toContain('COLLSCAN');
    expect(stringifyPlan(gradeExplain)).toContain('IXSCAN');
    expect(stringifyPlan(gradeExplain)).not.toContain('COLLSCAN');
  });
});
