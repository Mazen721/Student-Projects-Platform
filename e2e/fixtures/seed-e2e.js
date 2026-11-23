import {
  ACCOUNT_TYPES,
  PROPOSAL_STATUSES,
  ROLES,
  SCOPE_TYPES,
  SHOWCASE_STATES,
  STATUS_FLAGS,
  USER_STATUSES,
} from '@spp/shared/constants';
import { hashPassword } from '../../server/src/core/auth/tokens.js';
import User from '../../server/src/modules/auth/user.model.js';
import Rubric from '../../server/src/modules/evaluation/rubric.model.js';
import AcademicYear from '../../server/src/modules/organization/academicYear.model.js';
import College from '../../server/src/modules/organization/college.model.js';
import Department from '../../server/src/modules/organization/department.model.js';
import University from '../../server/src/modules/organization/university.model.js';
import Project from '../../server/src/modules/projects/project.model.js';
import ShowcasePage from '../../server/src/modules/showcase/showcasePage.model.js';
import PhaseTemplate from '../../server/src/modules/tracking/phaseTemplate.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedE2EData() {
  await University.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        name: 'جامعة المنصورة الأهلية',
        settings: {
          allowedEmailDomains: ['mnu.edu.eg'],
          minVoteAccountAgeHours: 24,
          voteBurstPerIp10m: 50,
        },
      },
    },
    { upsert: true, new: true }
  );

  const eng = await College.create({
    name: 'كلية الهندسة',
    code: 'ENG',
    settings: {
      teamSizeMin: 1,
      teamSizeMax: 5,
      allowCrossCollege: true,
      supervisorPrimaryCap: 5,
      passMark: 60,
      deliberationSpreadThreshold: 15,
      maxReEvaluationsPerProject: 1,
    },
  });
  const cs = await College.create({
    name: 'كلية الحاسبات والمعلومات',
    code: 'CS',
    settings: { teamSizeMin: 1, teamSizeMax: 5, supervisorPrimaryCap: 5, passMark: 60 },
  });

  const ce = await Department.create({
    name: 'هندسة الحاسبات والنظم',
    code: 'CE',
    collegeId: eng._id,
  });
  const csDept = await Department.create({
    name: 'علوم الحاسب',
    code: 'CS1',
    collegeId: cs._id,
  });

  const now = Date.now();
  const ayEng = await AcademicYear.create({
    collegeId: eng._id,
    label: '2026/2027',
    isCurrent: true,
    startDate: new Date(now - 90 * DAY_MS),
    endDate: new Date(now + 180 * DAY_MS),
    semesters: [
      {
        name: 'الفصل الأول',
        startDate: new Date(now - 90 * DAY_MS),
        endDate: new Date(now + 30 * DAY_MS),
      },
      {
        name: 'الفصل الثاني',
        startDate: new Date(now + 31 * DAY_MS),
        endDate: new Date(now + 180 * DAY_MS),
      },
    ],
    cycle: {
      registrationOpensAt: new Date(now - 30 * DAY_MS),
      registrationClosesAt: new Date(now + 30 * DAY_MS),
      proposalDeadline: new Date(now + 45 * DAY_MS),
      defenseStart: new Date(now - 2 * DAY_MS),
      defenseEnd: new Date(now + 60 * DAY_MS),
    },
  });

  await AcademicYear.create({
    collegeId: cs._id,
    label: '2026/2027',
    isCurrent: true,
    startDate: new Date(now - 90 * DAY_MS),
    endDate: new Date(now + 180 * DAY_MS),
    cycle: {
      registrationOpensAt: new Date(now - 30 * DAY_MS),
      registrationClosesAt: new Date(now + 30 * DAY_MS),
      proposalDeadline: new Date(now + 45 * DAY_MS),
    },
  });

  const passwordHash = await hashPassword('E2ePass123!');

  const uniAdmin = await User.create({
    name: 'مدير الجامعة',
    email: 'uni-admin@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STAFF,
    roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
  });

  const engAdmin = await User.create({
    name: 'عميد الهندسة',
    email: 'eng-admin@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: eng._id,
    roles: [
      {
        role: ROLES.COLLEGE_ADMIN,
        scopeType: SCOPE_TYPES.COLLEGE,
        scopeId: eng._id,
        collegeId: eng._id,
      },
    ],
  });

  const supervisor = await User.create({
    name: 'د. طارق المشرف',
    email: 'supervisor@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: eng._id,
    departmentId: ce._id,
    roles: [
      {
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: ce._id,
        collegeId: eng._id,
        departmentId: ce._id,
      },
      {
        role: ROLES.DEPARTMENT_ADMIN,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: ce._id,
        collegeId: eng._id,
        departmentId: ce._id,
      },
    ],
  });

  const examiner1 = await User.create({
    name: 'د. سلمى الممتحن الأول',
    email: 'examiner1@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: eng._id,
    departmentId: ce._id,
    roles: [
      {
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: ce._id,
        collegeId: eng._id,
        departmentId: ce._id,
      },
    ],
  });

  const examiner2 = await User.create({
    name: 'د. كريم الممتحن الثاني',
    email: 'examiner2@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STAFF,
    collegeId: eng._id,
    departmentId: ce._id,
    roles: [
      {
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: ce._id,
        collegeId: eng._id,
        departmentId: ce._id,
      },
    ],
  });

  const studentTeammate = await User.create({
    name: 'نور محمد',
    email: 'noor@mnu.edu.eg',
    studentId: '20269902',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STUDENT,
    collegeId: eng._id,
    departmentId: ce._id,
    roles: [
      {
        role: ROLES.STUDENT,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: ce._id,
        collegeId: eng._id,
        departmentId: ce._id,
      },
    ],
  });

  const visitorOld = await User.create({
    name: 'زائر قديم',
    email: 'visitor-old@example.com',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.VISITOR,
    roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
    createdAt: new Date(now - 72 * 60 * 60 * 1000),
  });

  await PhaseTemplate.create({
    collegeId: eng._id,
    name: 'قالب المراحل القياسي',
    isDefault: true,
    status: 'active',
    phases: [
      {
        key: 'analysis',
        order: 1,
        name: 'التحليل والتصميم',
        weight: 20,
        dueOffsetDays: 30,
        requiredDeliverables: [
          { key: 'srs', title: 'وثيقة المتطلبات' },
          { key: 'arch', title: 'مخطط المعمارية' },
        ],
      },
      {
        key: 'implementation',
        order: 2,
        name: 'التنفيذ والاختبار',
        weight: 80,
        dueOffsetDays: 60,
        requiredDeliverables: [{ key: 'proto', title: 'النموذج الأولي والاختبارات' }],
      },
    ],
  });

  await Rubric.create({
    collegeId: eng._id,
    academicYearId: ayEng._id,
    name: 'نموذج تقييم مشاريع الهندسة',
    status: 'active',
    supervisorPct: 40,
    committeePct: 60,
    criteria: [
      { key: 'design', name: 'التصميم الهندسي', appliesTo: 'team', weight: 50, maxScore: 100 },
      { key: 'presentation', name: 'العرض والمناقشة', appliesTo: 'individual', weight: 50, maxScore: 100 },
    ],
  });

  const demoProj = await Project.create({
    title: 'منظومة الري الذكي بالطاقة الشمسية',
    slug: 'smart-campus-demo',
    idea: 'نظام ذكي لترشيد استهلاك المياه والطاقة داخل الحرم الجامعي',
    problem: 'ارتفاع هدر المياه في المساحات الخضراء الجامعية',
    scope: 'حساسات رطوبة ولوحة متابعة سحابية',
    type: 'hybrid',
    field: 'iot_embedded',
    keywords: ['ري ذكي', 'طاقة شمسية'],
    beneficiaries: 'إدارة الحرم الجامعي',
    expectedOutcomes: 'خفض استهلاك المياه بنسبة ثلاثين بالمائة',
    collegeId: eng._id,
    departmentId: ce._id,
    academicYearId: ayEng._id,
    academicYearLabel: ayEng.label,
    status: PROPOSAL_STATUSES.APPROVED,
    progress: { percent: 100, perPhase: [] },
    statusFlag: STATUS_FLAGS.ON_TRACK,
    isPublished: true,
    featured: true,
    showcaseStats: { validVotes: 3, views7d: 12, votes7d: 3, trendingScore: 21 },
    team: {
      leaderId: studentTeammate._id,
      members: [{ userId: studentTeammate._id, role: 'leader' }],
    },
    activeMemberIds: [studentTeammate._id],
    supervision: { primaryId: supervisor._id },
  });

  await ShowcasePage.create({
    projectId: demoProj._id,
    slug: demoProj.slug,
    collegeId: eng._id,
    departmentId: ce._id,
    template: 'modern',
    theme: 'navy_gold',
    state: SHOWCASE_STATES.PUBLISHED,
    everApproved: true,
    sections: {
      hero: { slogan: 'منظومة متكاملة لمراقبة التربة والري التلقائي' },
      problem: 'ارتفاع هدر المياه في المساحات الخضراء الجامعية.',
      solution: 'توفير المياه وخفض تكاليف الصيانة باستخدام الطاقة النظيفة.',
    },
  });

  return {
    collegeId: String(eng._id),
    departmentId: String(ce._id),
    csDepartmentId: String(csDept._id),
    academicYearId: String(ayEng._id),
    uniAdminId: String(uniAdmin._id),
    engAdminId: String(engAdmin._id),
    supervisorId: String(supervisor._id),
    examiner1Id: String(examiner1._id),
    examiner2Id: String(examiner2._id),
    visitorOldEmail: visitorOld.email,
  };
}
