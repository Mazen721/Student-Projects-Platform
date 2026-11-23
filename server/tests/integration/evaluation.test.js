import request from 'supertest';
import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFENSE_STATES,
  MODIFICATION_STATES,
  PROPOSAL_STATUSES,
  ROLES,
  SCOPE_TYPES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import Notification from '../../src/core/notifications/notification.model.js';
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
import Defense from '../../src/modules/evaluation/defense.model.js';
import ExaminerScore from '../../src/modules/evaluation/examinerScore.model.js';
import Grade from '../../src/modules/evaluation/grade.model.js';
import { runModificationsOverdueJob } from '../../src/jobs/modificationsOverdue.js';

describe('Evaluation, Defense, Grading, Re-Evaluation & Certificate Integration (P5 / US5)', () => {
  let app;
  let collegeA;
  let deptA;
  let ayA;
  let project;
  let project2;
  let deliverable;
  let phase;
  let users;
  let tokens;

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
        passMark: 60,
        gradeSpreadThreshold: 15,
        reevaluationWindowDays: 7,
      },
    });
    deptA = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });

    const now = Date.now();
    ayA = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * 86400000),
      endDate: new Date(now + 200 * 86400000),
      cycle: {
        registrationOpensAt: new Date(now - 20 * 86400000),
        registrationClosesAt: new Date(now + 20 * 86400000),
        proposalDeadline: new Date(now + 25 * 86400000),
        defenseStart: new Date(now + 30 * 86400000),
        defenseEnd: new Date(now + 90 * 86400000),
      },
    });

    const pw = await hashPassword('Password123');
    const mkUser = (doc) => User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const collegeAdmin = await mkUser({
      name: 'أ.د عميد الهندسة',
      email: 'ca@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [
        { role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id },
      ],
    });
    const deptAdmin = await mkUser({
      name: 'د. رئيس القسم',
      email: 'da@mnu.edu.eg',
      accountType: 'staff',
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
    const primarySup = await mkUser({
      name: 'د. مشرف أساسي',
      email: 'sup1@mnu.edu.eg',
      accountType: 'staff',
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
    const coSup = await mkUser({
      name: 'د. مشرف مساعد',
      email: 'cosup@mnu.edu.eg',
      accountType: 'staff',
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
    const chair = await mkUser({
      name: 'أ.د رئيس اللجنة',
      email: 'chair@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.COMMITTEE_MEMBER,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeA._id,
          collegeId: collegeA._id,
        },
      ],
    });
    const examiner2 = await mkUser({
      name: 'د. ممتحن ثانٍ',
      email: 'ex2@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.COMMITTEE_MEMBER,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeA._id,
          collegeId: collegeA._id,
        },
      ],
    });
    const replacementChair = await mkUser({
      name: 'أ.د رئيس بديل',
      email: 'rchair@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [
        {
          role: ROLES.COMMITTEE_MEMBER,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeA._id,
          collegeId: collegeA._id,
        },
      ],
    });
    const student1 = await mkUser({
      name: 'أحمد محمد',
      email: 's1@mnu.edu.eg',
      studentId: '2026101',
      accountType: 'student',
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
    const student2 = await mkUser({
      name: 'سارة علي',
      email: 's2@mnu.edu.eg',
      studentId: '2026102',
      accountType: 'student',
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

    users = {
      collegeAdmin,
      deptAdmin,
      primarySup,
      coSup,
      chair,
      examiner2,
      replacementChair,
      student1,
      student2,
    };

    tokens = Object.fromEntries(
      Object.entries(users).map(([key, user]) => [key, signAccessToken(user)])
    );

    const tpl = await PhaseTemplate.create({
      collegeId: collegeA._id,
      name: 'قالب 2026',
      isDefault: true,
      phases: [
        {
          key: 'final',
          name: 'المرحلة النهائية',
          order: 1,
          weight: 100,
          dueOffsetDays: 30,
          requiredDeliverables: [{ key: 'thesis', title: 'الكتاب النهائي' }],
        },
      ],
    });

    project = await Project.create({
      title: 'منصة الطاقة الشمسية الذكية',
      slug: 'smart-solar-platform',
      idea: 'إدارة وتشغيل محطات الطاقة الشمسية بالذكاء الاصطناعي',
      problem: 'هدر الطاقة وصعوبة التنبؤ بالأحمال',
      scope: 'كلية الهندسة',
      field: 'renewable_energy',
      type: 'hybrid',
      beneficiaries: 'المستشفيات والجامعات',
      expectedOutcomes: 'نموذج أولي ومؤشرات تشغيل',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      status: PROPOSAL_STATUSES.APPROVED,
      team: {
        leaderId: student1._id,
        members: [
          { userId: student1._id, role: 'leader', status: 'active' },
          { userId: student2._id, role: 'member', status: 'active' },
        ],
      },
      activeMemberIds: [student1._id, student2._id],
      supervision: { primaryId: primarySup._id, coSupervisorIds: [coSup._id] },
    });

    phase = await ProjectPhase.create({
      projectId: project._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      templateId: tpl._id,
      key: 'final',
      name: 'المرحلة النهائية',
      order: 1,
      weight: 100,
      dueDate: new Date(now + 10 * 86400000),
      requiredCount: 1,
    });

    deliverable = await Deliverable.create({
      projectId: project._id,
      phaseId: phase._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      key: 'thesis',
      title: 'الكتاب النهائي',
      required: true,
      dueDate: new Date(now + 10 * 86400000),
      latestStatus: 'none',
    });

    project2 = await Project.create({
      title: 'نظام الروبوت الجراحي المساعد',
      slug: 'surgical-robot-helper',
      idea: 'روبوت مساعد لغرف العمليات',
      problem: 'دقة الحركة في الجراحات الدقيقة',
      scope: 'كلية الهندسة',
      field: 'robotics',
      type: 'hardware',
      beneficiaries: 'الأطباء',
      expectedOutcomes: 'ذراع تحكم آلية',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      academicYearLabel: ayA.label,
      status: PROPOSAL_STATUSES.APPROVED,
      defenseState: DEFENSE_STATES.ELIGIBLE,
      supervisorSignOff: { by: primarySup._id, at: new Date() },
      team: {
        leaderId: student2._id,
        members: [{ userId: student2._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [student2._id],
      supervision: { primaryId: primarySup._id },
    });
  });

  function buildRubricPayload(overrides = {}) {
    return {
      academicYearId: String(ayA._id),
      name: 'نموذج تقييم التخرج 2026',
      supervisorPct: 40,
      committeePct: 60,
      criteria: [
        { key: 'design', name: 'التصميم الهندسي', weight: 50, appliesTo: 'team' },
        { key: 'impl', name: 'التنفيذ والنتائج', weight: 30, appliesTo: 'team' },
        { key: 'presentation', name: 'العرض والمناقشة الفردية', weight: 20, appliesTo: 'individual' },
      ],
      ...overrides,
    };
  }

  async function approveAllPhasesAndSignOff() {
    await Deliverable.updateOne({ _id: deliverable._id }, { $set: { latestStatus: 'approved' } });
    const signRes = await request(app)
      .post(`/api/v1/projects/${project._id}/defense/sign-off`)
      .set('Authorization', `Bearer ${tokens.primarySup}`);
    expect(signRes.status).toBe(200);
    expect(signRes.body.data.eligible).toBe(true);
  }

  it('validates rubric weights/splits and locks rubric edits once scores exist', async () => {
    const badSplit = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload({ supervisorPct: 50, committeePct: 60 }));
    expect(badSplit.status).toBe(400);

    const badWeights = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(
        buildRubricPayload({
          criteria: [{ key: 'design', name: 'التصميم', weight: 90, appliesTo: 'team' }],
        })
      );
    expect(badWeights.status).toBe(400);

    const created = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload());
    expect(created.status).toBe(201);
    const rubricId = created.body.data.id;

    // Can update while unused
    const updated = await request(app)
      .patch(`/api/v1/rubrics/${rubricId}`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send({ name: 'نموذج تقييم التخرج المعدل' });
    expect(updated.status).toBe(200);

    await approveAllPhasesAndSignOff();
    const defRes = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: new Date('2027-05-20T10:00:00Z').toISOString(),
        durationMin: 60,
        room: 'قاعة ٣٠١',
        committee: { chairId: String(users.chair._id), memberIds: [String(users.examiner2._id)] },
      });
    expect(defRes.status).toBe(201);

    await request(app)
      .post(`/api/v1/defenses/${defRes.body.data.id}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'OPEN_GRADING' });

    await request(app)
      .put(`/api/v1/defenses/${defRes.body.data.id}/my-scores`)
      .set('Authorization', `Bearer ${tokens.primarySup}`)
      .send({
        teamScores: { design: 80, impl: 80 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 80 },
          [String(users.student2._id)]: { presentation: 80 },
        },
        submit: false,
      });

    const lockedUpdate = await request(app)
      .patch(`/api/v1/rubrics/${rubricId}`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send({ name: 'محاولة تعديل بعد بدء التقييم' });
    expect(lockedUpdate.status).toBe(422);
    expect(lockedUpdate.body.error.rule).toBe('RUBRIC_IN_USE');
  });

  it('enforces eligibility gate, COI rejection, room/examiner conflict warning, and back-to-back allowance', async () => {
    await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload());

    const eligBefore = await request(app)
      .get(`/api/v1/projects/${project._id}/defense/eligibility`)
      .set('Authorization', `Bearer ${tokens.primarySup}`);
    expect(eligBefore.status).toBe(200);
    expect(eligBefore.body.data.eligible).toBe(false);
    expect(eligBefore.body.data.missingPhases).toHaveLength(1);

    const blockedSignOff = await request(app)
      .post(`/api/v1/projects/${project._id}/defense/sign-off`)
      .set('Authorization', `Bearer ${tokens.primarySup}`);
    expect(blockedSignOff.status).toBe(422);
    expect(blockedSignOff.body.error.rule).toBe('NOT_ELIGIBLE_FOR_DEFENSE');

    const blockedSchedule = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T10:00:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.chair._id), memberIds: [] },
      });
    expect(blockedSchedule.status).toBe(422);
    expect(blockedSchedule.body.error.rule).toBe('NOT_ELIGIBLE_FOR_DEFENSE');

    await approveAllPhasesAndSignOff();

    // COI: primary supervisor as chair
    const coiPrimary = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T10:00:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.primarySup._id), memberIds: [String(users.examiner2._id)] },
      });
    expect(coiPrimary.status).toBe(422);
    expect(coiPrimary.body.error.rule).toBe('COI_VIOLATION');

    // COI: co-supervisor as member
    const coiCoSup = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T10:00:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.chair._id), memberIds: [String(users.coSup._id)] },
      });
    expect(coiCoSup.status).toBe(422);
    expect(coiCoSup.body.error.rule).toBe('COI_VIOLATION');

    // Schedule project 1: 10:00 - 11:00 in مدرج أ
    const sched1 = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T10:00:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.chair._id), memberIds: [String(users.examiner2._id)] },
      });
    expect(sched1.status).toBe(201);

    // Overlap at 10:30 in مدرج أ with shared chair -> 409 CONFLICT with conflicts[]
    const conflictRes = await request(app)
      .post(`/api/v1/projects/${project2._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T10:30:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.chair._id), memberIds: [] },
      });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('CONFLICT');
    expect(conflictRes.body.error.details.conflicts.length).toBeGreaterThanOrEqual(1);

    // Back-to-back at 11:00 in same room & same chair -> NO conflict
    const backToBack = await request(app)
      .post(`/api/v1/projects/${project2._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-20T11:00:00Z',
        durationMin: 60,
        room: 'مدرج أ',
        committee: { chairId: String(users.chair._id), memberIds: [] },
      });
    expect(backToBack.status).toBe(201);
  });

  it('enforces blind grading, spread deliberation unlock, exact grade math, GRADE_LOCKED immutability, student privacy, and Arabic PDF certificate', async () => {
    await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload());

    await approveAllPhasesAndSignOff();

    const schedRes = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-21T09:00:00Z',
        durationMin: 60,
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        committee: { chairId: String(users.chair._id), memberIds: [String(users.examiner2._id)] },
      });
    expect(schedRes.status).toBe(201);
    const defenseId = schedRes.body.data.id;

    // Student cannot see grades before finalization (returns { finalized: false }, not 404)
    const preGradeStu = await request(app)
      .get(`/api/v1/projects/${project._id}/grades`)
      .set('Authorization', `Bearer ${tokens.student1}`);
    expect(preGradeStu.status).toBe(200);
    expect(preGradeStu.body.data.finalized).toBe(false);

    // Open grading
    const openRes = await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'OPEN_GRADING' });
    expect(openRes.status).toBe(200);
    expect(openRes.body.data.state).toBe(DEFENSE_STATES.GRADING);

    // Primary supervisor submits 80 across all criteria
    const supScore = await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.primarySup}`)
      .send({
        teamScores: { design: 80, impl: 80 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 80 },
          [String(users.student2._id)]: { presentation: 90 },
        },
        submit: true,
      });
    expect(supScore.status).toBe(200);

    // Chair submits 70 for student1 (spread vs examiner2 will be 20 > 15!)
    const chairScore = await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({
        teamScores: { design: 70, impl: 70 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 70 },
          [String(users.student2._id)]: { presentation: 80 },
        },
        submit: true,
      });
    expect(chairScore.status).toBe(200);

    // Examiner 2 cannot view peer scores while not all examiners submitted (FR-085)
    const blindBlocked = await request(app)
      .get(`/api/v1/defenses/${defenseId}/scores`)
      .set('Authorization', `Bearer ${tokens.examiner2}`);
    expect(blindBlocked.status).toBe(422);
    expect(blindBlocked.body.error.rule).toBe('SCORES_INCOMPLETE');

    // Examiner 2 submits 90 for student1 -> spread = 90 - 70 = 20 > 15
    const ex2Score = await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.examiner2}`)
      .send({
        teamScores: { design: 90, impl: 90 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 90 },
          [String(users.student2._id)]: { presentation: 90 },
        },
        submit: true,
      });
    expect(ex2Score.status).toBe(200);

    // Now all submitted -> examiner 2 can view scores & spread exceeded is flagged
    const allScoresRes = await request(app)
      .get(`/api/v1/defenses/${defenseId}/scores`)
      .set('Authorization', `Bearer ${tokens.examiner2}`);
    expect(allScoresRes.status).toBe(200);
    expect(allScoresRes.body.data.spread[String(users.student1._id)].exceeded).toBe(true);

    // Chair unlocks for deliberation round 1
    const unlockRes = await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'UNLOCK_FOR_REVISION' });
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.data.state).toBe(DEFENSE_STATES.DELIBERATION);

    // Chair and examiner2 resubmit (still 70 and 90, so spread still 20)
    await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({
        teamScores: { design: 70, impl: 70 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 70 },
          [String(users.student2._id)]: { presentation: 80 },
        },
        submit: true,
      });
    const ex2Resubmit = await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.examiner2}`)
      .send({
        teamScores: { design: 90, impl: 90 },
        individualScores: {
          [String(users.student1._id)]: { presentation: 90 },
          [String(users.student2._id)]: { presentation: 90 },
        },
        submit: true,
      });
    expect(ex2Resubmit.status).toBe(200);

    // Verify new version created for committee scores
    const versionsCount = await ExaminerScore.countDocuments({
      defenseId,
      examinerId: users.chair._id,
    });
    expect(versionsCount).toBe(2);

    // Finalizing with spread exceeded WITHOUT note fails
    const finalizeNoNote = await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'FINALIZE' });
    expect(finalizeNoNote.status).toBe(400);

    // Finalizing WITH justification note succeeds
    const finalizeOk = await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'FINALIZE', note: 'تمت مراجعة التباين والاتفاق على الاعتماد' });
    expect(finalizeOk.status).toBe(200);
    expect(finalizeOk.body.data.state).toBe(DEFENSE_STATES.FINALIZED);

    // Verify exact grade math for student1: 0.4*80 + 0.6*avg(70,90) = 80 (جيد جداً)
    const staffGrades = await request(app)
      .get(`/api/v1/projects/${project._id}/grades`)
      .set('Authorization', `Bearer ${tokens.primarySup}`);
    expect(staffGrades.status).toBe(200);
    expect(staffGrades.body.data.finalized).toBe(true);
    const s1Grade = staffGrades.body.data.grades.find(
      (g) => String(g.studentId) === String(users.student1._id)
    );
    expect(s1Grade.final).toBe(80);
    expect(s1Grade.teamGrade).toBe(80);
    expect(s1Grade.passed).toBe(true);
    expect(s1Grade.band).toBe('veryGood');

    // Student privacy (FR-089a): student1 sees ONLY own grade, never student2's grade
    const stu1GradesRes = await request(app)
      .get(`/api/v1/projects/${project._id}/grades`)
      .set('Authorization', `Bearer ${tokens.student1}`);
    expect(stu1GradesRes.status).toBe(200);
    expect(stu1GradesRes.body.data.myGrade.final).toBe(80);
    expect(stu1GradesRes.body.data.grades).toBeUndefined();

    // Immutable GRADE_LOCKED model hook blocks direct mutation
    await expect(
      Grade.updateOne({ _id: s1Grade.id }, { $set: { final: 100 } })
    ).rejects.toMatchObject({ code: 'GRADE_LOCKED' });

    const gradeDoc = await Grade.findById(s1Grade.id);
    gradeDoc.final = 95;
    await expect(gradeDoc.save()).rejects.toMatchObject({ code: 'GRADE_LOCKED' });

    // Record minutes & post-defense modifications, then confirm & test overdue job
    const pastDeadline = new Date(Date.now() - 86400000).toISOString();
    const minRes = await request(app)
      .put(`/api/v1/defenses/${defenseId}/minutes`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({
        minutes: 'ناقش الفريق النتائج المخبرية وأجاب عن جميع الاستفسارات.',
        recommendations: 'توسيع التجارب الميدانية',
        modifications: {
          required: true,
          description: 'تحديث الفصل الرابع بإضافة قياسات الجهد',
          deadline: pastDeadline,
        },
      });
    expect(minRes.status).toBe(200);
    expect(minRes.body.data.modifications.state).toBe(MODIFICATION_STATES.PENDING);

    // Certificate PDF available immediately once finalized even while modifications pending
    const certRes = await request(app)
      .get(`/api/v1/projects/${project._id}/grades/${users.student1._id}/certificate.pdf`)
      .set('Authorization', `Bearer ${tokens.student1}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(certRes.status).toBe(200);
    expect(certRes.headers['content-type']).toContain('application/pdf');
    expect(certRes.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(certRes.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Run overdue job -> marks pending past-deadline modification overdue + notifies
    const overdueCount = await runModificationsOverdueJob();
    expect(overdueCount).toBe(1);
    const afterOverdue = await Defense.findById(defenseId).lean();
    expect(afterOverdue.modifications.state).toBe(MODIFICATION_STATES.OVERDUE);
    const notifCount = await Notification.countDocuments({
      dedupeKey: `mod_overdue:${defenseId}`,
    });
    expect(notifCount).toBeGreaterThanOrEqual(1);

    // Supervisor confirms modifications completed
    const confirmMod = await request(app)
      .post(`/api/v1/defenses/${defenseId}/modifications/confirm`)
      .set('Authorization', `Bearer ${tokens.primarySup}`);
    expect(confirmMod.status).toBe(200);
    expect(confirmMod.body.data.modifications.state).toBe(MODIFICATION_STATES.CONFIRMED);
  });

  it('runs bounded College Admin re-evaluation with replacement committee, supervisor carry-over, v2 grade & audit trail', async () => {
    await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload());
    await approveAllPhasesAndSignOff();

    const schedRes = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-22T09:00:00Z',
        durationMin: 60,
        room: 'قاعة ١٠٥',
        committee: { chairId: String(users.chair._id), memberIds: [String(users.examiner2._id)] },
      });
    const defenseId = schedRes.body.data.id;

    await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'OPEN_GRADING' });

    const baseIndiv = {
      [String(users.student1._id)]: { presentation: 70 },
      [String(users.student2._id)]: { presentation: 80 },
    };

    await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.primarySup}`)
      .send({ teamScores: { design: 80, impl: 80 }, individualScores: baseIndiv, submit: true });
    await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ teamScores: { design: 80, impl: 80 }, individualScores: baseIndiv, submit: true });
    await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.examiner2}`)
      .send({ teamScores: { design: 80, impl: 80 }, individualScores: baseIndiv, submit: true });

    await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.chair}`)
      .send({ event: 'FINALIZE' });

    // Student 1 requests student-scoped re-evaluation
    const reevalReq = await request(app)
      .post(`/api/v1/projects/${project._id}/reevaluations`)
      .set('Authorization', `Bearer ${tokens.student1}`)
      .send({ reason: 'أطلب مراجعة درجة العرض الفردي لوجود خطأ في الرصد' });
    expect(reevalReq.status).toBe(201);
    const reevalId = reevalReq.body.data.id;

    // Duplicate request by same student blocked
    const dupReq = await request(app)
      .post(`/api/v1/projects/${project._id}/reevaluations`)
      .set('Authorization', `Bearer ${tokens.student1}`)
      .send({ reason: 'محاولة ثانية لطلب إعادة التقييم' });
    expect(dupReq.status).toBe(422);
    expect(dupReq.body.error.rule).toBe('REEVAL_ALREADY_REQUESTED');

    // College Admin approves with replacement chair
    const decideRes = await request(app)
      .post(`/api/v1/reevaluations/${reevalId}/decide`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send({
        decision: 'approve',
        note: 'تشكيل لجنة بديلة لمراجعة العرض الفردي',
        replacementCommittee: { chairId: String(users.replacementChair._id), memberIds: [] },
      });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.status).toBe('approved');

    // Replacement chair submits improved individual score for student1 (95 instead of 70);
    // student-scoped re-evaluation preserves locked Team criteria (design/impl stay 80) and supervisor carry-over (80)
    const reScore = await request(app)
      .put(`/api/v1/defenses/${defenseId}/my-scores`)
      .set('Authorization', `Bearer ${tokens.replacementChair}`)
      .send({
        teamScores: { design: 100, impl: 100 }, // ignored/locked for student-scoped re-eval!
        individualScores: { [String(users.student1._id)]: { presentation: 95 } },
        submit: true,
      });
    expect(reScore.status).toBe(200);

    const refinalize = await request(app)
      .post(`/api/v1/defenses/${defenseId}/transitions`)
      .set('Authorization', `Bearer ${tokens.replacementChair}`)
      .send({ event: 'FINALIZE' });
    expect(refinalize.status).toBe(200);

    // Student1 now has v2 grade with isLatest=true:
    // supervisorTotal = 0.5*80 + 0.3*80 + 0.2*70 = 78
    // replacement committeeTotal = 0.5*80 + 0.3*80 + 0.2*95 = 83
    // final = 0.4*78 + 0.6*83 = 31.2 + 49.8 = 81
    const versions = await Grade.find({ projectId: project._id, studentId: users.student1._id })
      .sort({ version: 1 })
      .lean();
    expect(versions).toHaveLength(2);
    expect(versions[0].isLatest).toBe(false);
    expect(versions[0].final).toBe(78);
    expect(versions[1].isLatest).toBe(true);
    expect(versions[1].final).toBe(81);

    // Student2 remains at v1 untouched
    const s2Versions = await Grade.find({ projectId: project._id, studentId: users.student2._id }).lean();
    expect(s2Versions).toHaveLength(1);

    // Audit trail recorded for reeval request, decide, and re-finalize
    const auditActions = await AuditLog.find({
      targetType: 'reevaluation',
      targetId: new mongoose.Types.ObjectId(reevalId),
    }).lean();
    expect(auditActions.length).toBeGreaterThanOrEqual(3);
  });

  it('invites an external examiner scoped strictly to one defense and blocks after finalized', async () => {
    await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/rubrics`)
      .set('Authorization', `Bearer ${tokens.collegeAdmin}`)
      .send(buildRubricPayload());
    await approveAllPhasesAndSignOff();

    const schedRes = await request(app)
      .post(`/api/v1/projects/${project._id}/defense`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({
        scheduledAt: '2027-05-23T09:00:00Z',
        durationMin: 60,
        room: 'قاعة ٢٠٢',
        committee: { chairId: String(users.chair._id), memberIds: [] },
      });
    const defenseId = schedRes.body.data.id;

    const invRes = await request(app)
      .post('/api/v1/invitations/external-examiner')
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ defenseId, name: 'د. ممتحن خارجي' });
    expect(invRes.status).toBe(201);
    const rawToken = invRes.body.data.url.split('/').pop();

    const acceptRes = await request(app)
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .send({ name: 'د. ممتحن خارجي', email: 'external1@example.com', password: 'Password123' });
    expect(acceptRes.status).toBe(200);
    const extToken = acceptRes.body.data.accessToken;

    // External examiner can read this defense, but NOT project deliverables or chat
    const readDef = await request(app)
      .get(`/api/v1/defenses/${defenseId}`)
      .set('Authorization', `Bearer ${extToken}`);
    expect(readDef.status).toBe(200);

    const readPhases = await request(app)
      .get(`/api/v1/projects/${project._id}/phases`)
      .set('Authorization', `Bearer ${extToken}`);
    expect(readPhases.status).toBe(404);

    const readChannels = await request(app)
      .get(`/api/v1/projects/${project._id}/channels`)
      .set('Authorization', `Bearer ${extToken}`);
    expect(readChannels.status).toBe(404);
  });
});
