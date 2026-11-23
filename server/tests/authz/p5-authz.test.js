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
import Deliverable from '../../src/modules/tracking/deliverable.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';
import ProjectPhase from '../../src/modules/tracking/projectPhase.model.js';
import Committee from '../../src/modules/evaluation/committee.model.js';
import Defense from '../../src/modules/evaluation/defense.model.js';
import ExaminerScore from '../../src/modules/evaluation/examinerScore.model.js';
import Grade from '../../src/modules/evaluation/grade.model.js';
import ReEvaluationRequest from '../../src/modules/evaluation/reevaluationRequest.model.js';
import Rubric from '../../src/modules/evaluation/rubric.model.js';

describe('P5 Authorization Matrix (Evaluation & Defense)', () => {
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
        registrationOpensAt: new Date(now - 10 * 86400000),
        registrationClosesAt: new Date(now + 20 * 86400000),
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
      name: 'مشرف أ',
      email: 'sup@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const chair = await createU({
      name: 'رئيس لجنة',
      email: 'chair@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COMMITTEE_MEMBER, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const outsiderExaminer = await createU({
      name: 'ممتحن خارجي ب',
      email: 'exb@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeB._id,
      roles: [{ role: ROLES.COMMITTEE_MEMBER, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeB._id, collegeId: collegeB._id }],
    });
    const studentTeam = await createU({
      name: 'طالب الفريق',
      email: 'st1@mnu.edu.eg',
      studentId: '2026901',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const outsiderStudent = await createU({
      name: 'طالب خارجي',
      email: 'st2@mnu.edu.eg',
      studentId: '2026902',
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB._id, collegeId: collegeB._id, departmentId: deptB._id }],
    });

    const tpl = await PhaseTemplate.create({
      collegeId: collegeA._id,
      name: 'قالب أ',
      isDefault: true,
      phases: [{ key: 'p1', name: 'مرحلة', order: 1, weight: 100, dueOffsetDays: 30, requiredDeliverables: [] }],
    });

    const project = await Project.create({
      title: 'مشروع صلاحيات التقييم',
      slug: 'eval-authz-project',
      idea: 'فكرة اختبار الصلاحيات',
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
      defenseState: 'finalized',
      supervisorSignOff: { by: primarySup._id, at: new Date() },
      team: {
        leaderId: studentTeam._id,
        members: [{ userId: studentTeam._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [studentTeam._id],
      supervision: { primaryId: primarySup._id },
    });

    const projectSignOff = await Project.create({
      title: 'مشروع اختبار التأهل',
      slug: 'eval-authz-signoff',
      idea: 'فكرة اختبار التأهل',
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
      defenseState: 'not_eligible',
      team: {
        leaderId: studentTeam._id,
        members: [{ userId: studentTeam._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [studentTeam._id],
      supervision: { primaryId: primarySup._id },
    });

    const phase = await ProjectPhase.create({
      projectId: projectSignOff._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      templateId: tpl._id,
      key: 'p1',
      name: 'مرحلة',
      order: 1,
      weight: 100,
      dueDate: new Date('2027-01-01'),
      completedBySupervisor: { by: primarySup._id, at: new Date() },
    });
    await Deliverable.create({
      projectId: projectSignOff._id,
      phaseId: phase._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      key: 'd1',
      title: 'مخرج اختياري',
      required: false,
      dueDate: new Date('2027-01-01'),
    });

    const rubric = await Rubric.create({
      collegeId: collegeA._id,
      academicYearId: ayA._id,
      name: 'نموذج كلية الهندسة',
      supervisorPct: 40,
      committeePct: 60,
      criteria: [{ key: 'c1', name: 'المعيار الأول', weight: 100, appliesTo: 'team' }],
      status: 'active',
    });

    const editableRubric = await Rubric.create({
      collegeId: collegeA._id,
      academicYearId: ayA._id,
      name: 'نموذج قابل للتعديل',
      supervisorPct: 50,
      committeePct: 50,
      criteria: [{ key: 'c1', name: 'المعيار الأول', weight: 100, appliesTo: 'team' }],
      status: 'active',
    });

    const committee = await Committee.create({
      projectId: project._id,
      chairId: chair._id,
      memberIds: [],
      externalExaminerIds: [],
      allExaminerIds: [chair._id],
      createdBy: deptAdminA._id,
    });

    const defense = await Defense.create({
      projectId: project._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      rubricId: rubric._id,
      state: 'grading',
      scheduledAt: new Date('2027-05-01T10:00:00Z'),
      durationMin: 60,
      room: 'قاعة ١',
      committeeId: committee._id,
      chairId: chair._id,
      examinerIds: [chair._id],
      supervisorIds: [primarySup._id],
      eligibleMemberIds: [studentTeam._id],
      finalizedAt: new Date(),
    });
    committee.defenseId = defense._id;
    await committee.save();

    const finalizedProject = await Project.create({
      title: 'مشروع مكتمل التقييم',
      slug: 'eval-authz-finalized',
      idea: 'فكرة اختبار التقييم',
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
      defenseState: 'finalized',
      team: {
        leaderId: studentTeam._id,
        members: [{ userId: studentTeam._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [studentTeam._id],
      supervision: { primaryId: primarySup._id },
    });

    const finalizedDefense = await Defense.create({
      projectId: finalizedProject._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      rubricId: rubric._id,
      state: 'reevaluation_requested',
      scheduledAt: new Date('2027-05-02T10:00:00Z'),
      durationMin: 60,
      room: 'قاعة ٢',
      committeeId: committee._id,
      chairId: chair._id,
      examinerIds: [chair._id],
      supervisorIds: [primarySup._id],
      eligibleMemberIds: [studentTeam._id],
      finalizedAt: new Date(),
      modifications: { required: true, description: 'تعديل الشكل', deadline: new Date('2027-06-01'), state: 'pending' },
    });

    await ExaminerScore.create({
      defenseId: finalizedDefense._id,
      projectId: finalizedProject._id,
      examinerId: primarySup._id,
      component: 'supervisor',
      version: 1,
      teamScores: { c1: 80 },
      totals: { [String(studentTeam._id)]: 80 },
      submittedAt: new Date(),
    });
    await ExaminerScore.create({
      defenseId: finalizedDefense._id,
      projectId: finalizedProject._id,
      examinerId: chair._id,
      component: 'committee',
      version: 1,
      teamScores: { c1: 85 },
      totals: { [String(studentTeam._id)]: 85 },
      submittedAt: new Date(),
    });

    await Grade.create({
      projectId: finalizedProject._id,
      studentId: studentTeam._id,
      defenseId: finalizedDefense._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      version: 1,
      isLatest: true,
      supervisorTotal: 85,
      committeeAvg: 85,
      final: 85,
      teamGrade: 85,
      perCriterion: [{ key: 'c1', supervisor: 85, committeeAvg: 85 }],
      passed: true,
      band: 'excellent',
      locked: true,
      finalizedAt: new Date(),
      finalizedBy: chair._id,
    });

    const reeval = await ReEvaluationRequest.create({
      projectId: finalizedProject._id,
      defenseId: finalizedDefense._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      scope: 'student',
      studentId: studentTeam._id,
      requestedBy: studentTeam._id,
      requesterRole: 'student',
      reason: 'أرغب في إعادة مراجعة التقييم النهائي',
      status: 'pending',
    });

    tokens = {
      collegeAdminA: signAccessToken(collegeAdminA),
      collegeAdminB: signAccessToken(collegeAdminB),
      deptAdminA: signAccessToken(deptAdminA),
      primarySup: signAccessToken(primarySup),
      chair: signAccessToken(chair),
      outsiderExaminer: signAccessToken(outsiderExaminer),
      studentTeam: signAccessToken(studentTeam),
      outsiderStudent: signAccessToken(outsiderStudent),
    };

    resources = {
      collegeAId: String(collegeA._id),
      ayAId: String(ayA._id),
      rubricId: String(editableRubric._id),
      projectId: String(project._id),
      projectSignOffId: String(projectSignOff._id),
      finalizedProjectId: String(finalizedProject._id),
      defenseId: String(defense._id),
      finalizedDefenseId: String(finalizedDefense._id),
      studentTeamId: String(studentTeam._id),
      reevalId: String(reeval._id),
    };
  });

  const cases = [
    [
      'rubric.list',
      () => ({ method: 'get', path: `/api/v1/colleges/${resources.collegeAId}/rubrics` }),
      'collegeAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'rubric.create',
      () => ({
        method: 'post',
        path: `/api/v1/colleges/${resources.collegeAId}/rubrics`,
        body: {
          academicYearId: resources.ayAId,
          name: 'نموذج جديد',
          supervisorPct: 40,
          committeePct: 60,
          criteria: [{ key: 'c1', name: 'معيار', weight: 100, appliesTo: 'team' }],
        },
      }),
      'collegeAdminA',
      [201],
      'deptAdminA',
      404,
    ],
    [
      'rubric.update',
      () => ({
        method: 'patch',
        path: `/api/v1/rubrics/${resources.rubricId}`,
        body: { name: 'اسم محدث' },
      }),
      'collegeAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'defense.read (eligibility)',
      () => ({ method: 'get', path: `/api/v1/projects/${resources.projectSignOffId}/defense/eligibility` }),
      'primarySup',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'defense.signOff',
      () => ({ method: 'post', path: `/api/v1/projects/${resources.projectSignOffId}/defense/sign-off` }),
      'primarySup',
      [200],
      'studentTeam',
      404,
    ],
    [
      'defense.list',
      () => ({ method: 'get', path: '/api/v1/defenses' }),
      'deptAdminA',
      [200],
      'studentTeam',
      403,
    ],
    [
      'defense.read',
      () => ({ method: 'get', path: `/api/v1/defenses/${resources.defenseId}` }),
      'chair',
      [200],
      'outsiderExaminer',
      404,
    ],
    [
      'score.submit (GET scoresheet)',
      () => ({ method: 'get', path: `/api/v1/defenses/${resources.defenseId}/my-scoresheet` }),
      'chair',
      [200],
      'outsiderExaminer',
      404,
    ],
    [
      'score.submit (PUT scores)',
      () => ({
        method: 'put',
        path: `/api/v1/defenses/${resources.defenseId}/my-scores`,
        body: { teamScores: { c1: 85 }, individualScores: {}, submit: false },
      }),
      'chair',
      [200],
      'studentTeam',
      404,
    ],
    [
      'score.viewAll',
      () => ({ method: 'get', path: `/api/v1/defenses/${resources.finalizedDefenseId}/scores` }),
      'chair',
      [200],
      'studentTeam',
      404,
    ],
    [
      'defense.recordMinutes',
      () => ({
        method: 'put',
        path: `/api/v1/defenses/${resources.defenseId}/minutes`,
        body: { minutes: 'محضر المناقشة الرسمي للمشروع' },
      }),
      'chair',
      [200],
      'primarySup',
      404,
    ],
    [
      'defense.confirmModifications',
      () => ({ method: 'post', path: `/api/v1/defenses/${resources.finalizedDefenseId}/modifications/confirm` }),
      'primarySup',
      [200],
      'chair',
      404,
    ],
    [
      'grade.read',
      () => ({ method: 'get', path: `/api/v1/projects/${resources.finalizedProjectId}/grades` }),
      'studentTeam',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'reeval.list',
      () => ({ method: 'get', path: '/api/v1/reevaluations' }),
      'collegeAdminA',
      [200],
      'studentTeam',
      403,
    ],
    [
      'reeval.decide',
      () => ({
        method: 'post',
        path: `/api/v1/reevaluations/${resources.reevalId}/decide`,
        body: { decision: 'reject', note: 'الدرجة مطابقة لمعايير اللجنة' },
      }),
      'collegeAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'certificate.download (self student vs outsider student)',
      () => ({
        method: 'get',
        path: `/api/v1/projects/${resources.finalizedProjectId}/grades/${resources.studentTeamId}/certificate.pdf`,
      }),
      'studentTeam',
      [200],
      'outsiderStudent',
      404,
    ],
  ];

  it.each(cases)(
    '%s: allows in-scope actor and denies out-of-scope actor',
    async (_label, buildReq, allowActor, allowStatuses, denyActor, denyStatus) => {
      const cfg = buildReq();
      const allowReq = request(app)[cfg.method](cfg.path).set('Authorization', `Bearer ${tokens[allowActor]}`);
      if (cfg.body) allowReq.send(cfg.body);
      const allowRes = await allowReq;
      expect(allowStatuses).toContain(allowRes.status);

      const denyReq = request(app)[cfg.method](cfg.path).set('Authorization', `Bearer ${tokens[denyActor]}`);
      if (cfg.body) denyReq.send(cfg.body);
      const denyRes = await denyReq;
      expect(denyRes.status).toBe(denyStatus);
    }
  );
});
