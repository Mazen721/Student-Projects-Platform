import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  PROPOSAL_STATUSES,
  ROLES,
  SCOPE_TYPES,
  SHOWCASE_STATES,
  USER_STATUSES,
  VOTE_STATUSES,
} from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import Challenge from '../../src/modules/showcase/challenge.model.js';
import Competition from '../../src/modules/showcase/competition.model.js';
import ContactRequest from '../../src/modules/showcase/contactRequest.model.js';
import PublicComment from '../../src/modules/showcase/publicComment.model.js';
import ShowcasePage from '../../src/modules/showcase/showcasePage.model.js';
import Vote from '../../src/modules/showcase/vote.model.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('P6 Authorization Matrix (Showcase, Voting & Investors)', () => {
  let app;
  let tokens;
  let resources;

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'], minVoteAccountAgeHours: 0 },
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
    const ay = await AcademicYear.create({
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
    const collegeAdminB = await makeUser({
      name: 'عميد الحاسبات',
      email: 'cb@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.STAFF,
      collegeId: collegeB._id,
      roles: [
        {
          role: ROLES.COLLEGE_ADMIN,
          scopeType: SCOPE_TYPES.COLLEGE,
          scopeId: collegeB._id,
          collegeId: collegeB._id,
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
    const leader = await makeUser({
      name: 'قائد الفريق',
      email: 'leader@mnu.edu.eg',
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
    const member = await makeUser({
      name: 'عضو الفريق',
      email: 'member@mnu.edu.eg',
      studentId: '2026002',
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
    const studentA = await makeUser({
      name: 'طالب أ',
      email: 'st-a@mnu.edu.eg',
      studentId: '2026003',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeB._id,
      departmentId: deptB._id,
      roles: [
        {
          role: ROLES.STUDENT,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptB._id,
          collegeId: collegeB._id,
          departmentId: deptB._id,
        },
      ],
    });
    const studentB = await makeUser({
      name: 'طالب ب',
      email: 'st-b@mnu.edu.eg',
      studentId: '2026004',
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
      email: 'investor@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.INVESTOR,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });
    const pendingInvestor = await makeUser({
      name: 'مستثمر معلّق',
      email: 'pending@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.INVESTOR,
      status: USER_STATUSES.PENDING,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });

    const baseProject = {
      idea: 'فكرة المشروع',
      problem: 'مشكلة المشروع',
      scope: 'نطاق المشروع',
      field: 'software_engineering',
      type: 'software',
      beneficiaries: 'المستفيدون',
      expectedOutcomes: 'النتائج',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ay._id,
      academicYearLabel: ay.label,
      status: PROPOSAL_STATUSES.APPROVED,
      team: {
        leaderId: leader._id,
        members: [
          { userId: leader._id, role: 'leader', status: 'active' },
          { userId: member._id, role: 'member', status: 'active' },
        ],
      },
      activeMemberIds: [leader._id, member._id],
      supervision: { primaryId: supervisor._id },
    };

    const publishedProject = await Project.create({
      ...baseProject,
      title: 'Smart Campus',
      slug: 'smart-campus',
      isPublished: true,
    });
    const draftProject = await Project.create({
      ...baseProject,
      title: 'Draft Showcase',
      slug: 'draft-showcase',
    });
    const pendingProject = await Project.create({
      ...baseProject,
      title: 'Pending Showcase',
      slug: 'pending-showcase',
    });

    await ShowcasePage.create({
      projectId: publishedProject._id,
      slug: publishedProject.slug,
      state: SHOWCASE_STATES.PUBLISHED,
      everApproved: true,
      template: 'classic',
      theme: 'navy_gold',
      sections: { solution: 'حل المشكلة' },
      hiddenSections: [],
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });
    await ShowcasePage.create({
      projectId: draftProject._id,
      slug: draftProject.slug,
      state: SHOWCASE_STATES.DRAFT,
      everApproved: false,
      template: 'classic',
      theme: 'navy_gold',
      sections: {},
      hiddenSections: [],
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });
    await ShowcasePage.create({
      projectId: pendingProject._id,
      slug: pendingProject.slug,
      state: SHOWCASE_STATES.PENDING_APPROVAL,
      everApproved: false,
      template: 'classic',
      theme: 'navy_gold',
      sections: {},
      hiddenSections: [],
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });

    const flaggedVote = await Vote.create({
      projectId: publishedProject._id,
      userId: studentA._id,
      status: VOTE_STATUSES.FLAGGED,
      ipHash: 'hash',
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });

    const contactRequest = await ContactRequest.create({
      projectId: publishedProject._id,
      investorId: investor._id,
      message: 'نرغب في التواصل بخصوص فرص الاستثمار',
      state: 'pending',
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });

    const challenge = await Challenge.create({
      investorId: investor._id,
      title: 'تحدي المدن الذكية',
      description: 'نبحث عن حلول مبتكرة لإدارة الحركة',
      field: 'iot_embedded',
      status: 'open',
    });

    const comment = await PublicComment.create({
      projectId: publishedProject._id,
      authorId: studentA._id,
      text: 'سؤال عن المشروع',
      state: 'visible',
      collegeId: collegeA._id,
      departmentId: deptA._id,
    });

    const competition = await Competition.create({
      title: 'مسابقة الكلية',
      scopeType: 'college',
      scopeId: collegeA._id,
      collegeId: collegeA._id,
      eligibleProjectIds: [publishedProject._id],
      voterRestriction: 'all',
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + HOUR),
      state: 'open',
      createdBy: collegeAdminA._id,
    });

    tokens = {
      uniAdmin: signAccessToken(uniAdmin),
      collegeAdminA: signAccessToken(collegeAdminA),
      collegeAdminB: signAccessToken(collegeAdminB),
      supervisor: signAccessToken(supervisor),
      leader: signAccessToken(leader),
      member: signAccessToken(member),
      studentA: signAccessToken(studentA),
      studentB: signAccessToken(studentB),
      investor: signAccessToken(investor),
      pendingInvestor: signAccessToken(pendingInvestor),
    };

    resources = {
      collegeAId: String(collegeA._id),
      publishedProjectId: String(publishedProject._id),
      draftProjectId: String(draftProject._id),
      pendingProjectId: String(pendingProject._id),
      flaggedVoteId: String(flaggedVote._id),
      contactRequestId: String(contactRequest._id),
      challengeId: String(challenge._id),
      commentId: String(comment._id),
      competitionId: String(competition._id),
    };
  });

  const cases = [
    [
      'showcase.edit (read builder)',
      () => ({ method: 'get', path: `/api/v1/projects/${resources.publishedProjectId}/showcase` }),
      'leader',
      [200],
      'studentA',
      404,
    ],
    [
      'showcase.edit (write builder)',
      () => ({
        method: 'put',
        path: `/api/v1/projects/${resources.publishedProjectId}/showcase`,
        body: {
          template: 'modern',
          theme: 'deep_navy_slate',
          sections: { solution: 'تحديث' },
          hiddenSections: [],
        },
      }),
      'leader',
      [200],
      'studentA',
      404,
    ],
    [
      'showcase.edit (preview)',
      () => ({
        method: 'get',
        path: `/api/v1/projects/${resources.publishedProjectId}/showcase/preview`,
      }),
      'supervisor',
      [200],
      'studentA',
      404,
    ],
    [
      'showcase.transition (request publish)',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.draftProjectId}/showcase/transitions`,
        body: { event: 'REQUEST_PUBLISH' },
      }),
      'leader',
      [200],
      'studentA',
      404,
    ],
    [
      'showcase.transition (first approval supervisor only)',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.pendingProjectId}/showcase/transitions`,
        body: { event: 'APPROVE' },
      }),
      'supervisor',
      [200],
      'member',
      403,
    ],
    [
      'vote.cast',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.publishedProjectId}/vote`,
        body: {},
      }),
      'studentB',
      [201],
      'pendingInvestor',
      403,
    ],
    [
      'vote.review (flagged queue)',
      () => ({ method: 'get', path: '/api/v1/votes/flagged' }),
      'collegeAdminA',
      [200],
      'studentA',
      403,
    ],
    [
      'vote.review (single flagged vote)',
      () => ({
        method: 'post',
        path: `/api/v1/votes/${resources.flaggedVoteId}/review`,
        body: { decision: 'clear' },
      }),
      'collegeAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'competition.create',
      () => ({
        method: 'post',
        path: '/api/v1/competitions',
        body: {
          title: 'مسابقة جديدة',
          scopeType: 'college',
          scopeId: String(resources.collegeAId || ''),
          eligibleProjectIds: [resources.publishedProjectId],
          voterRestriction: 'all',
          startsAt: new Date(Date.now() - HOUR).toISOString(),
          endsAt: new Date(Date.now() + HOUR).toISOString(),
        },
      }),
      'collegeAdminA',
      [201],
      'supervisor',
      403,
    ],
    [
      'investor.follow',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.publishedProjectId}/follow`,
        body: {},
      }),
      'investor',
      [201],
      'studentB',
      404,
    ],
    [
      'investor.bookmark',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.publishedProjectId}/bookmark`,
        body: {},
      }),
      'investor',
      [201],
      'studentB',
      404,
    ],
    [
      'contact.request',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.publishedProjectId}/contact-requests`,
        body: { message: 'طلب تواصل مع فريق المشروع' },
      }),
      'investor',
      [201],
      'studentB',
      404,
    ],
    [
      'contact.list',
      () => ({
        method: 'get',
        path: `/api/v1/projects/${resources.publishedProjectId}/contact-requests`,
      }),
      'leader',
      [200],
      'studentA',
      404,
    ],
    [
      'contact.decide (leader only)',
      () => ({
        method: 'post',
        path: `/api/v1/contact-requests/${resources.contactRequestId}/decide`,
        body: { decision: 'accept', reply: { text: 'مرحباً بكم' } },
      }),
      'leader',
      [200],
      'member',
      404,
    ],
    [
      'challenge.create',
      () => ({
        method: 'post',
        path: '/api/v1/challenges',
        body: {
          title: 'تحدي جديد للطلاب',
          description: 'وصف كافٍ للتحدي الجديد المطروح',
          field: 'ai',
        },
      }),
      'investor',
      [201],
      'studentB',
      403,
    ],
    [
      'challenge.remove',
      () => ({
        method: 'post',
        path: `/api/v1/challenges/${resources.challengeId}/remove`,
        body: { reason: 'مخالف للسياسة' },
      }),
      'collegeAdminA',
      [200],
      'investor',
      404,
    ],
    [
      'publicComment.create',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.publishedProjectId}/public-comments`,
        body: { text: 'تعليق عام جديد على المشروع' },
      }),
      'studentB',
      [201],
      'pendingInvestor',
      403,
    ],
    [
      'publicComment.report',
      () => ({
        method: 'post',
        path: `/api/v1/public-comments/${resources.commentId}/report`,
        body: { reason: 'محتوى غير لائق' },
      }),
      'studentB',
      [201],
      'pendingInvestor',
      403,
    ],
    [
      'publicComment.moderate',
      () => ({
        method: 'post',
        path: `/api/v1/public-comments/${resources.commentId}/moderate`,
        body: { action: 'hide' },
      }),
      'member',
      [200],
      'studentB',
      404,
    ],
    [
      'showcase.feature (university featured)',
      () => ({
        method: 'put',
        path: '/api/v1/university/featured',
        body: { projectIds: [resources.publishedProjectId] },
      }),
      'uniAdmin',
      [200],
      'collegeAdminA',
      403,
    ],
  ];

  it.each(cases)(
    '%s: allows in-scope actor and denies out-of-scope actor',
    async (_label, buildReq, allowActor, allowStatuses, denyActor, denyStatus) => {
      const cfg = buildReq();
      const allowReq = request(app)[cfg.method](cfg.path).set(
        'Authorization',
        `Bearer ${tokens[allowActor]}`
      );
      if (cfg.body) allowReq.send(cfg.body);
      const allowRes = await allowReq;
      expect(allowStatuses).toContain(allowRes.status);

      const denyReq = request(app)[cfg.method](cfg.path).set(
        'Authorization',
        `Bearer ${tokens[denyActor]}`
      );
      if (cfg.body) denyReq.send(cfg.body);
      const denyRes = await denyReq;
      expect(denyRes.status).toBe(denyStatus);
    }
  );

  it('public showcase endpoints stay reachable without authentication', async () => {
    const home = await request(app).get('/api/v1/public/home');
    expect(home.status).toBe(200);

    const detail = await request(app).get('/api/v1/public/projects/smart-campus');
    expect(detail.status).toBe(200);

    const projectList = await request(app).get('/api/v1/public/projects');
    expect(projectList.status).toBe(200);

    const publicCompetitions = await request(app).get('/api/v1/public/competitions');
    expect(publicCompetitions.status).toBe(200);
  });
});
