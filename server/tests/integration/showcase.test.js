import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  CONTACT_REQUEST_STATES,
  PROPOSAL_STATUSES,
  PUBLIC_COMMENT_STATES,
  ROLES,
  SCOPE_TYPES,
  SHOWCASE_STATES,
  USER_STATUSES,
  VOTE_STATUSES,
} from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import BOMItem from '../../src/modules/tracking/bomItem.model.js';
import Task from '../../src/modules/tracking/task.model.js';
import Challenge from '../../src/modules/showcase/challenge.model.js';
import Competition from '../../src/modules/showcase/competition.model.js';
import ContactRequest from '../../src/modules/showcase/contactRequest.model.js';
import Follow from '../../src/modules/showcase/follow.model.js';
import Bookmark from '../../src/modules/showcase/bookmark.model.js';
import PageView from '../../src/modules/showcase/pageView.model.js';
import PublicComment from '../../src/modules/showcase/publicComment.model.js';
import Vote from '../../src/modules/showcase/vote.model.js';
import { runTrendingJob } from '../../src/jobs/trending.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function withAuth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

function collectPaths(value, base = '', paths = []) {
  if (value === null || typeof value !== 'object') return paths;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPaths(entry, `${base}[${index}]`, paths));
    return paths;
  }
  for (const [key, child] of Object.entries(value)) {
    paths.push(`${base}.${key}`);
    collectPaths(child, `${base}.${key}`, paths);
  }
  return paths;
}

describe('Public Showcase, Voting & Investors Integration (P6 / US6)', () => {
  let app;
  let university;
  let collegeA;
  let collegeB;
  let deptA;
  let deptB;
  let ay;
  let project;
  let users;
  let tokens;
  let passwords;

  async function backdate(userId, hours) {
    await User.collection.updateOne(
      { _id: userId },
      { $set: { createdAt: new Date(Date.now() - hours * HOUR) } }
    );
  }

  async function makeUser(doc, { backdateHours = 48 } = {}) {
    const passwordHash = passwords.hash;
    const user = await User.create({
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      ...doc,
    });
    if (backdateHours != null) await backdate(user._id, backdateHours);
    return user;
  }

  async function publishShowcase({ template = 'modern', theme = 'navy_gold' } = {}) {
    await withAuth(
      request(app).put(`/api/v1/projects/${project._id}/showcase`),
      tokens.leader
    ).send({
      template,
      theme,
      sections: {
        hero: { slogan: 'طريق أذكى للحرم الجامعي' },
        problem: 'صعوبة التنقل داخل الحرم الجامعي',
        solution: 'تطبيق إرشاد داخلي بالخرائط',
        features: ['إرشاد لحظي', 'مسارات مخصصة'],
        technologies: ['React', 'Node.js'],
        components: ['لوحة تحكم', 'مستشعرات'],
        achievements: ['المركز الأول في معرض الكلية'],
        interest: 'نبحث عن شريك للتنفيذ',
      },
      hiddenSections: [],
    });

    await withAuth(
      request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
      tokens.leader
    ).send({ event: 'REQUEST_PUBLISH' });

    return withAuth(
      request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
      tokens.supervisor
    ).send({ event: 'APPROVE' });
  }

  beforeEach(async () => {
    app = createApp();
    passwords = { hash: await hashPassword('Password123') };

    university = await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: {
        allowedEmailDomains: ['mnu.edu.eg'],
        minVoteAccountAgeHours: 24,
        voteBurstPerIp10m: 50,
      },
    });

    collegeA = await College.create({ name: 'كلية الهندسة', code: 'ENG' });
    collegeB = await College.create({ name: 'كلية الحاسبات', code: 'CS' });
    deptA = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    deptB = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    const now = Date.now();
    ay = await AcademicYear.create({
      collegeId: collegeA._id,
      label: '2026/2027',
      isCurrent: true,
      startDate: new Date(now - 30 * DAY),
      endDate: new Date(now + 200 * DAY),
      cycle: {
        registrationOpensAt: new Date(now - 20 * DAY),
        registrationClosesAt: new Date(now + 20 * DAY),
        proposalDeadline: new Date(now + 25 * DAY),
      },
    });

    const universityAdmin = await makeUser({
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
    const leader = await makeUser({
      name: 'قائد الفريق',
      email: 'leader@mnu.edu.eg',
      studentId: '2026001',
      accountType: ACCOUNT_TYPES.STUDENT,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      privacy: { email: 'private', phone: 'private', socialLinks: 'private' },
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
      profile: { phone: '+201000000002' },
      privacy: { email: 'public', phone: 'public', socialLinks: 'private' },
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
    const supervisor = await makeUser({
      name: 'د. المشرف',
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
    const student = await makeUser({
      name: 'طالب ناخب',
      email: 'voter@mnu.edu.eg',
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
    const youngStudent = await makeUser(
      {
        name: 'طالب جديد',
        email: 'young@mnu.edu.eg',
        studentId: '2026004',
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
      },
      { backdateHours: 2 }
    );
    const impostor = await makeUser({
      name: 'حساب منتحل',
      email: 'impostor@mnu.edu.eg',
      studentId: '2026999',
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
      name: 'مستثمر قيد المراجعة',
      email: 'pending-investor@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.INVESTOR,
      status: USER_STATUSES.PENDING,
      roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
    });
    const visitor = await makeUser({
      name: 'زائر',
      email: 'visitor@mnu.edu.eg',
      accountType: ACCOUNT_TYPES.VISITOR,
      roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
    });

    users = {
      universityAdmin,
      collegeAdminA,
      collegeAdminB,
      leader,
      member,
      supervisor,
      student,
      youngStudent,
      impostor,
      investor,
      pendingInvestor,
      visitor,
    };
    tokens = Object.fromEntries(
      Object.entries(users).map(([key, user]) => [key, signAccessToken(user)])
    );

    project = await Project.create({
      title: 'Smart Campus Navigation',
      slug: 'smart-campus-navigation',
      idea: 'منصة إرشاد داخل الحرم الجامعي',
      problem: 'صعوبة الوصول إلى القاعات والمرافق',
      scope: 'الحرم الجامعي بالكامل',
      field: 'software_engineering',
      type: 'software',
      beneficiaries: 'الطلاب وأعضاء هيئة التدريس',
      expectedOutcomes: 'تقليل وقت التنقل وتحسين تجربة الزوار',
      keywords: ['تنقل', 'خرائط', 'حرم جامعي'],
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
      budgetEstimate: 987654,
      history: [{ to: 'approved', event: 'APPROVE', actorId: supervisor._id }],
    });

    await BOMItem.create({
      projectId: project._id,
      collegeId: collegeA._id,
      academicYearId: ay._id,
      academicYearLabel: ay.label,
      item: 'مستشعرات داخلية',
      quantity: 5,
      unitPrice: 1234,
      supplier: 'SecretSupplierCo',
    });
    await Task.create({
      projectId: project._id,
      title: 'مهمة داخلية سرية',
      createdBy: leader._id,
    });
  });

  describe('mini-site publication lifecycle', () => {
    it('requires supervisor approval for first publication and keeps the page private meanwhile', async () => {
      const initial = await withAuth(
        request(app).get(`/api/v1/projects/${project._id}/showcase`),
        tokens.leader
      );
      expect(initial.status).toBe(200);
      expect(initial.body.data.state).toBe(SHOWCASE_STATES.DRAFT);

      const updated = await withAuth(
        request(app).put(`/api/v1/projects/${project._id}/showcase`),
        tokens.leader
      ).send({
        template: 'modern',
        theme: 'navy_gold',
        sections: {
          hero: { slogan: 'طريق أذكى للحرم الجامعي' },
          problem: 'صعوبة التنقل داخل الحرم الجامعي',
          solution: 'تطبيق إرشاد داخلي بالخرائط',
          components: ['لوحة تحكم'],
        },
        hiddenSections: [],
      });
      expect(updated.status).toBe(200);
      expect(updated.body.data.state).toBe(SHOWCASE_STATES.DRAFT);

      const requested = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.leader
      ).send({ event: 'REQUEST_PUBLISH' });
      expect(requested.status).toBe(200);
      expect(requested.body.data.state).toBe(SHOWCASE_STATES.PENDING_APPROVAL);

      const blocked = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(blocked.status).toBe(404);
      expect(blocked.body.error.code).toBe('NOT_FOUND');
      expect(blocked.headers['cache-control']).toBe('no-store');

      const forbidden = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.leader
      ).send({ event: 'APPROVE' });
      expect(forbidden.status).toBe(403);

      const approved = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.supervisor
      ).send({ event: 'APPROVE' });
      expect(approved.status).toBe(200);
      expect(approved.body.data.state).toBe(SHOWCASE_STATES.PUBLISHED);

      const publicPage = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(publicPage.status).toBe(200);
      expect(publicPage.headers['cache-control']).toBe('no-store');
      expect(publicPage.body.data.title).toBe('Smart Campus Navigation');
      expect(publicPage.body.data.state).toBeUndefined();
      expect(publicPage.body.data.projectId).toBeUndefined();

      const refreshed = await Project.findById(project._id).lean();
      expect(refreshed.isPublished).toBe(true);
    });

    it('publishes routine edits live after the first approval without another review', async () => {
      const published = await publishShowcase();
      expect(published.status).toBe(200);

      const edit = await withAuth(
        request(app).put(`/api/v1/projects/${project._id}/showcase`),
        tokens.leader
      ).send({
        template: 'minimal',
        theme: 'warm_ivory_navy',
        sections: { solution: 'نسخة محدثة مباشرة بعد الاعتماد' },
        hiddenSections: ['achievements'],
      });
      expect(edit.status).toBe(200);
      expect(edit.body.data.state).toBe(SHOWCASE_STATES.PUBLISHED);

      const publicPage = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(publicPage.status).toBe(200);
      expect(publicPage.body.data.template).toBe('minimal');
      expect(publicPage.body.data.theme).toBe('warm_ivory_navy');
      expect(publicPage.body.data.sections.solution).toBe('نسخة محدثة مباشرة بعد الاعتماد');
      expect(publicPage.body.data.sections.achievements).toBeUndefined();
    });

    it('requires a reason for takedown and fresh approval before republishing', async () => {
      await publishShowcase();

      const noReason = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.supervisor
      ).send({ event: 'TAKE_DOWN' });
      expect(noReason.status).toBe(400);
      expect(noReason.body.error.code).toBe('VALIDATION_ERROR');

      const takenDown = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.collegeAdminA
      ).send({ event: 'TAKE_DOWN', reason: 'مخالفة سياسة المحتوى' });
      expect(takenDown.status).toBe(200);
      expect(takenDown.body.data.state).toBe(SHOWCASE_STATES.TAKEN_DOWN);

      const hidden = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(hidden.status).toBe(404);
      const afterTakedown = await Project.findById(project._id).lean();
      expect(afterTakedown.isPublished).toBe(false);

      const reRequested = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.leader
      ).send({ event: 'REQUEST_PUBLISH' });
      expect(reRequested.status).toBe(200);
      expect(reRequested.body.data.state).toBe(SHOWCASE_STATES.PENDING_APPROVAL);

      const reApproved = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.supervisor
      ).send({ event: 'APPROVE' });
      expect(reApproved.status).toBe(200);
      expect(reApproved.body.data.state).toBe(SHOWCASE_STATES.PUBLISHED);
    });

    it('serves a strict allow-list projection with zero private leakage', async () => {
      await publishShowcase();

      const res = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(res.status).toBe(200);

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('987654');
      expect(serialized).not.toContain('SecretSupplierCo');
      expect(serialized).not.toContain('مهمة داخلية سرية');
      expect(serialized).not.toContain('leader@mnu.edu.eg');
      expect(serialized).not.toContain('2026001');
      expect(serialized).not.toContain('validVotes');
      expect(serialized).not.toContain('showcaseStats');

      const paths = collectPaths(res.body.data);
      for (const path of paths) {
        expect(path).not.toMatch(
          /(budget|supplier|unitPrice|bom|deliverable|task|meeting|message|chat|grade)/i
        );
      }

      expect(res.body.data.team).toHaveLength(2);
      const leader = res.body.data.team.find((member) => member.name === 'قائد الفريق');
      const member = res.body.data.team.find((member) => member.name === 'عضو الفريق');
      expect(leader.sharedContacts.email).toBeUndefined();
      expect(leader.sharedContacts.phone).toBeUndefined();
      expect(member.sharedContacts.email).toBe('member@mnu.edu.eg');
      expect(member.sharedContacts.phone).toBe('+201000000002');
      expect(member.sharedContacts.socialLinks).toBeUndefined();

      const emails = JSON.stringify(res.body).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) || [];
      expect(emails).toEqual(['member@mnu.edu.eg']);
    });
  });

  describe('public listings, search and page views', () => {
    it('lists featured, trending and most-voted projects for logged-out visitors', async () => {
      await publishShowcase();

      const featured = await withAuth(
        request(app).put('/api/v1/university/featured'),
        tokens.universityAdmin
      ).send({ projectIds: [String(project._id)] });
      expect(featured.status).toBe(200);

      await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      ).send({});

      const home = await request(app).get('/api/v1/public/home');
      expect(home.status).toBe(200);
      expect(home.headers['cache-control']).toBe('public, max-age=30, must-revalidate');
      expect(home.body.data.featured.map((p) => p.slug)).toContain('smart-campus-navigation');
      expect(home.body.data.trending.map((p) => p.slug)).toContain('smart-campus-navigation');
      expect(home.body.data.mostVoted[0].slug).toBe('smart-campus-navigation');
      expect(home.body.data.mostVoted[0].voteCount).toBe(1);
      expect(Array.isArray(home.body.data.colleges)).toBe(true);
      expect(home.body.data.colleges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: String(collegeA._id), name: 'كلية الهندسة' }),
        ])
      );
    });

    it('searches and filters public cards', async () => {
      await publishShowcase();

      const all = await request(app).get('/api/v1/public/projects');
      expect(all.status).toBe(200);
      expect(all.body.data).toHaveLength(1);
      expect(all.body.data[0].slug).toBe('smart-campus-navigation');

      const search = await request(app).get('/api/v1/public/projects').query({ q: 'smart campus' });
      expect(search.status).toBe(200);
      expect(search.body.data.map((p) => p.slug)).toEqual(['smart-campus-navigation']);

      const byCollege = await request(app)
        .get('/api/v1/public/projects')
        .query({ collegeId: String(collegeB._id) });
      expect(byCollege.status).toBe(200);
      expect(byCollege.body.data).toHaveLength(0);

      const collegeShowcase = await request(app).get(
        `/api/v1/public/colleges/${collegeA._id}/showcase`
      );
      expect(collegeShowcase.status).toBe(200);
      expect(collegeShowcase.body.data.items.map((p) => p.slug)).toEqual([
        'smart-campus-navigation',
      ]);
      expect(collegeShowcase.headers['cache-control']).toBe(
        'public, max-age=30, must-revalidate'
      );
    });

    it('dedupes the daily page-view beacon and feeds trending', async () => {
      await publishShowcase();

      const first = await request(app)
        .post('/api/v1/public/projects/smart-campus-navigation/view')
        .set('User-Agent', 'vitest-browser');
      expect(first.status).toBe(204);
      const second = await request(app)
        .post('/api/v1/public/projects/smart-campus-navigation/view')
        .set('User-Agent', 'vitest-browser');
      expect(second.status).toBe(204);

      expect(await PageView.countDocuments({ projectId: project._id })).toBe(1);
      let fresh = await Project.findById(project._id).lean();
      expect(fresh.showcaseStats.views7d).toBe(1);

      await runTrendingJob();
      fresh = await Project.findById(project._id).lean();
      expect(fresh.showcaseStats.trendingScore).toBe(1);

      await request(app)
        .post('/api/v1/public/projects/smart-campus-navigation/view')
        .set('User-Agent', 'another-browser');
      expect(await PageView.countDocuments({ projectId: project._id })).toBe(2);
    });

    it('exposes only university and college names/logos publicly', async () => {
      const universityRes = await request(app).get('/api/v1/public/university');
      expect(universityRes.status).toBe(200);
      expect(universityRes.body.data.name).toBe('جامعة المنصورة الأهلية');
      expect(universityRes.body.data.settings).toBeUndefined();

      const collegesRes = await request(app).get('/api/v1/public/colleges');
      expect(collegesRes.status).toBe(200);
      expect(collegesRes.body.data).toHaveLength(2);
      expect(collegesRes.body.data[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), name: expect.any(String) })
      );
      expect(collegesRes.body.data[0].settings).toBeUndefined();
    });
  });

  describe('voting & anti-fraud', () => {
    it('enforces one vote per user per project and supports withdrawal', async () => {
      await publishShowcase();

      const first = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(first.status).toBe(201);
      expect(first.body.data).toEqual({ status: VOTE_STATUSES.VALID, voteCount: 1 });

      const duplicate = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('ALREADY_VOTED');

      const detail = await withAuth(
        request(app).get('/api/v1/public/projects/smart-campus-navigation'),
        tokens.student
      );
      expect(detail.status).toBe(200);
      expect(detail.body.data.voteCount).toBe(1);
      expect(detail.body.data.viewer).toEqual({ hasVoted: true, canVote: false });

      const withdrawn = await withAuth(
        request(app).delete(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      );
      expect(withdrawn.status).toBe(204);

      const after = await Project.findById(project._id).lean();
      expect(after.showcaseStats.validVotes).toBe(0);
      expect(await Vote.countDocuments({ projectId: project._id, userId: users.student._id })).toBe(0);

      const detailAfter = await withAuth(
        request(app).get('/api/v1/public/projects/smart-campus-navigation'),
        tokens.student
      );
      expect(detailAfter.body.data.viewer.hasVoted).toBe(false);
      expect(detailAfter.body.data.voteCount).toBe(0);
    });

    it('blocks self-votes, young accounts and inactive accounts', async () => {
      await publishShowcase();

      const selfVote = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.leader
      ).send({});
      expect(selfVote.status).toBe(422);
      expect(selfVote.body.error.code).toBe('BUSINESS_RULE');
      expect(selfVote.body.error.rule).toBe('SELF_VOTE');

      const young = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.youngStudent
      ).send({});
      expect(young.status).toBe(422);
      expect(young.body.error.rule).toBe('VOTE_ACCOUNT_TOO_NEW');
      expect(young.body.error.vars.availableAt).toBeDefined();
      expect(Number.isNaN(Date.parse(young.body.error.vars.availableAt))).toBe(false);

      const pending = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.pendingInvestor
      ).send({});
      expect(pending.status).toBe(403);
      expect(pending.body.error.code).toBe('ACCOUNT_PENDING');

      const stats = await Project.findById(project._id).lean();
      expect(stats.showcaseStats.validVotes).toBe(0);
    });

    it('flags votes over the per-IP burst threshold and lets admins clear or reject them', async () => {
      await publishShowcase();
      await University.updateOne(
        { _id: university._id },
        { $set: { 'settings.voteBurstPerIp10m': 2 } }
      );

      const extraVoter = await makeUser({
        name: 'ناخب ثالث',
        email: 'voter3@mnu.edu.eg',
        studentId: '2026005',
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
      const extraToken = signAccessToken(extraVoter);

      const one = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(one.status).toBe(201);
      expect(one.body.data).toEqual({ status: VOTE_STATUSES.VALID, voteCount: 1 });

      const two = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.visitor
      ).send({});
      expect(two.status).toBe(201);
      expect(two.body.data).toEqual({ status: VOTE_STATUSES.VALID, voteCount: 2 });

      const three = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        extraToken
      ).send({});
      expect(three.status).toBe(201);
      expect(three.body.data).toEqual({ status: VOTE_STATUSES.FLAGGED, voteCount: 2 });

      const flaggedVote = await Vote.findOne({
        projectId: project._id,
        userId: extraVoter._id,
      }).lean();
      expect(flaggedVote.status).toBe(VOTE_STATUSES.FLAGGED);

      const queue = await withAuth(
        request(app).get('/api/v1/votes/flagged'),
        tokens.collegeAdminA
      );
      expect(queue.status).toBe(200);
      expect(queue.body.data).toHaveLength(1);
      expect(queue.body.data[0].id).toBe(String(flaggedVote._id));
      expect(queue.body.data[0].status).toBe(VOTE_STATUSES.FLAGGED);

      const cleared = await withAuth(
        request(app).post(`/api/v1/votes/${flaggedVote._id}/review`),
        tokens.collegeAdminA
      ).send({ decision: 'clear' });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.voteCount).toBe(3);

      const afterClear = await Project.findById(project._id).lean();
      expect(afterClear.showcaseStats.validVotes).toBe(3);

      const fourthVoter = await makeUser({
        name: 'ناخب رابع',
        email: 'voter4@mnu.edu.eg',
        studentId: '2026006',
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
      const four = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        signAccessToken(fourthVoter)
      ).send({});
      expect(four.body.data.status).toBe(VOTE_STATUSES.FLAGGED);

      const flaggedAgain = await Vote.findOne({
        projectId: project._id,
        userId: fourthVoter._id,
      }).lean();
      const rejected = await withAuth(
        request(app).post(`/api/v1/votes/${flaggedAgain._id}/review`),
        tokens.collegeAdminA
      ).send({ decision: 'reject' });
      expect(rejected.status).toBe(200);

      const finalProject = await Project.findById(project._id).lean();
      expect(finalProject.showcaseStats.validVotes).toBe(3);
      const rejectedVote = await Vote.findById(flaggedAgain._id).lean();
      expect(rejectedVote.status).toBe(VOTE_STATUSES.REJECTED);
    });

    it('invalidates an impostor vote when identifiers are released (FR-013a)', async () => {
      await publishShowcase();

      const vote = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.impostor
      ).send({});
      expect(vote.status).toBe(201);
      expect(vote.body.data.voteCount).toBe(1);

      const deactivated = await withAuth(
        request(app).post(`/api/v1/users/${users.impostor._id}/deactivate`),
        tokens.collegeAdminA
      ).send({ reason: 'حساب منتحل - تحرير الهوية', releaseIdentifiers: true });
      expect(deactivated.status).toBe(200);

      const invalidated = await Vote.findOne({
        projectId: project._id,
        userId: users.impostor._id,
      }).lean();
      expect(invalidated.status).toBe(VOTE_STATUSES.REJECTED);

      const fresh = await Project.findById(project._id).lean();
      expect(fresh.showcaseStats.validVotes).toBe(0);

      const publicPage = await request(app).get('/api/v1/public/projects/smart-campus-navigation');
      expect(publicPage.body.data.voteCount).toBe(0);
    });
  });

  describe('competitions & freezing', () => {
    it('isolates competition votes, blocks closed voting and freezes rankings', async () => {
      await publishShowcase();

      const created = await withAuth(
        request(app).post('/api/v1/competitions'),
        tokens.collegeAdminA
      ).send({
        title: 'مسابقة أفضل مشروع هندسي',
        scopeType: 'college',
        scopeId: String(collegeA._id),
        eligibleProjectIds: [String(project._id)],
        voterRestriction: 'university_only',
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
      });
      expect(created.status).toBe(201);
      expect(created.body.data.state).toBe('open');
      const competitionId = created.body.data.id;

      const generalVote = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(generalVote.status).toBe(201);

      const competitionVote = await withAuth(
        request(app).post(`/api/v1/competitions/${competitionId}/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(competitionVote.status).toBe(201);

      const duplicate = await withAuth(
        request(app).post(`/api/v1/competitions/${competitionId}/projects/${project._id}/vote`),
        tokens.student
      ).send({});
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('ALREADY_VOTED');

      const generalStats = await Project.findById(project._id).lean();
      expect(generalStats.showcaseStats.validVotes).toBe(1);

      const publicCompetition = await request(app).get(
        `/api/v1/public/competitions/${competitionId}`
      );
      expect(publicCompetition.status).toBe(200);
      expect(publicCompetition.body.data.ranking[0]).toMatchObject({
        projectId: String(project._id),
        votes: 1,
      });

      await Competition.updateOne(
        { _id: competitionId },
        { $set: { endsAt: new Date(Date.now() - HOUR) } }
      );

      const late = await withAuth(
        request(app).post(`/api/v1/competitions/${competitionId}/projects/${project._id}/vote`),
        tokens.visitor
      ).send({});
      expect(late.status).toBe(422);
      expect(late.body.error.rule).toBe('COMPETITION_CLOSED');

      const withdraw = await withAuth(
        request(app).delete(
          `/api/v1/competitions/${competitionId}/projects/${project._id}/vote`
        ),
        tokens.student
      );
      expect(withdraw.status).toBe(422);
      expect(withdraw.body.error.rule).toBe('COMPETITION_CLOSED');

      const frozen = await request(app).get(`/api/v1/public/competitions/${competitionId}`);
      expect(frozen.status).toBe(200);
      expect(frozen.body.data.state).toBe('closed');
      expect(frozen.body.data.frozenRanking).toEqual([
        expect.objectContaining({ projectId: String(project._id), votes: 1, rank: 1 }),
      ]);
    });

    it('enforces the university-only voter restriction and competition windows', async () => {
      await publishShowcase();

      const created = await withAuth(
        request(app).post('/api/v1/competitions'),
        tokens.universityAdmin
      ).send({
        title: 'مسابقة الجامعة',
        scopeType: 'university',
        eligibleProjectIds: [String(project._id)],
        voterRestriction: 'university_only',
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + HOUR).toISOString(),
      });
      expect(created.status).toBe(201);

      const investorVote = await withAuth(
        request(app).post(
          `/api/v1/competitions/${created.body.data.id}/projects/${project._id}/vote`
        ),
        tokens.investor
      ).send({});
      expect(investorVote.status).toBe(422);
      expect(investorVote.body.error.rule).toBe('VOTER_NOT_UNIVERSITY');
    });
  });

  describe('investors: follows, bookmarks, contact requests & challenges', () => {
    it('tracks follows and bookmarks for approved investors', async () => {
      await publishShowcase();

      const follow = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/follow`),
        tokens.investor
      ).send({});
      expect(follow.status).toBe(201);

      const bookmark = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/bookmark`),
        tokens.investor
      ).send({});
      expect(bookmark.status).toBe(201);

      const follows = await withAuth(
        request(app).get('/api/v1/me/follows'),
        tokens.investor
      );
      expect(follows.status).toBe(200);
      expect(follows.body.data.map((p) => p.slug)).toEqual(['smart-campus-navigation']);

      const bookmarks = await withAuth(
        request(app).get('/api/v1/me/bookmarks'),
        tokens.investor
      );
      expect(bookmarks.status).toBe(200);
      expect(bookmarks.body.data.map((p) => p.slug)).toEqual(['smart-campus-navigation']);

      const stats = await Project.findById(project._id).lean();
      expect(stats.showcaseStats.follows).toBe(1);
      expect(stats.showcaseStats.bookmarks).toBe(1);
      expect(await Follow.countDocuments({ projectId: project._id })).toBe(1);
      expect(await Bookmark.countDocuments({ projectId: project._id })).toBe(1);

      const pending = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/follow`),
        tokens.pendingInvestor
      ).send({});
      expect(pending.status).toBe(403);
      expect(pending.body.error.code).toBe('ACCOUNT_PENDING');
    });

    it('reveals only explicitly shared contact fields and only the leader can decide', async () => {
      await publishShowcase();

      const created = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/contact-requests`),
        tokens.investor
      ).send({ message: 'نرغب في مناقشة فرص الاستثمار في المشروع' });
      expect(created.status).toBe(201);
      expect(created.body.data.state).toBe(CONTACT_REQUEST_STATES.PENDING);

      const requestId = created.body.data.id;

      const memberDecision = await withAuth(
        request(app).post(`/api/v1/contact-requests/${requestId}/decide`),
        tokens.member
      ).send({ decision: 'accept', reply: { text: 'مرحباً', sharedContacts: { email: 'member@mnu.edu.eg' } } });
      expect(memberDecision.status).toBe(404);
      expect(memberDecision.body.error.code).toBe('NOT_FOUND');

      const accepted = await withAuth(
        request(app).post(`/api/v1/contact-requests/${requestId}/decide`),
        tokens.leader
      ).send({
        decision: 'accept',
        reply: {
          text: 'يسعدنا التواصل معكم',
          sharedContacts: { email: 'leader@mnu.edu.eg', phone: '+201000000001' },
        },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.state).toBe(CONTACT_REQUEST_STATES.ACCEPTED);

      const mine = await withAuth(
        request(app).get('/api/v1/me/contact-requests'),
        tokens.investor
      );
      expect(mine.status).toBe(200);
      expect(mine.body.data[0].reply.sharedContacts).toEqual({
        email: 'leader@mnu.edu.eg',
        phone: '+201000000001',
      });
      expect(mine.body.data[0].reply.sharedContacts.other).toBeUndefined();

      const teamView = await withAuth(
        request(app).get(`/api/v1/projects/${project._id}/contact-requests`),
        tokens.leader
      );
      expect(teamView.status).toBe(200);
      expect(teamView.body.data).toHaveLength(1);

      const second = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/contact-requests`),
        tokens.investor
      ).send({ message: 'طلب ثانٍ للتواصل حول المشروع' });
      expect(second.status).toBe(201);

      const declined = await withAuth(
        request(app).post(`/api/v1/contact-requests/${second.body.data.id}/decide`),
        tokens.leader
      ).send({ decision: 'decline' });
      expect(declined.status).toBe(200);
      expect(declined.body.data.state).toBe(CONTACT_REQUEST_STATES.DECLINED);
      expect(await ContactRequest.countDocuments({ projectId: project._id })).toBe(2);
    });

    it('blocks new contact requests while unpublished but keeps accepted replies readable', async () => {
      await publishShowcase();

      const created = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/contact-requests`),
        tokens.investor
      ).send({ message: 'طلب تواصل قبل إلغاء النشر' });
      await withAuth(
        request(app).post(`/api/v1/contact-requests/${created.body.data.id}/decide`),
        tokens.leader
      ).send({
        decision: 'accept',
        reply: { text: 'بيانات التواصل', sharedContacts: { email: 'leader@mnu.edu.eg' } },
      });

      const unpublished = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/showcase/transitions`),
        tokens.leader
      ).send({ event: 'UNPUBLISH' });
      expect(unpublished.status).toBe(200);

      const blocked = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/contact-requests`),
        tokens.investor
      ).send({ message: 'طلب جديد بعد إلغاء النشر' });
      expect(blocked.status).toBe(404);

      const mine = await withAuth(
        request(app).get('/api/v1/me/contact-requests'),
        tokens.investor
      );
      expect(mine.status).toBe(200);
      expect(mine.body.data[0].state).toBe(CONTACT_REQUEST_STATES.ACCEPTED);
      expect(mine.body.data[0].reply.sharedContacts.email).toBe('leader@mnu.edu.eg');
    });

    it('lets approved investors publish challenges and scoped admins remove them with audit', async () => {
      const created = await withAuth(
        request(app).post('/api/v1/challenges'),
        tokens.investor
      ).send({
        title: 'تحدي المدن الذكية',
        description: 'نبحث عن حلول مبتكرة لإدارة الحركة داخل المدن الجامعية',
        field: 'iot_embedded',
      });
      expect(created.status).toBe(201);
      expect(created.body.data.status).toBe('open');

      const list = await withAuth(request(app).get('/api/v1/challenges'), tokens.student);
      expect(list.status).toBe(200);
      expect(list.body.data.map((c) => c.title)).toContain('تحدي المدن الذكية');

      const removed = await withAuth(
        request(app).post(`/api/v1/challenges/${created.body.data.id}/remove`),
        tokens.collegeAdminA
      ).send({ reason: 'مخالف لسياسة المحتوى' });
      expect(removed.status).toBe(200);
      expect(removed.body.data.status).toBe('removed');

      const fresh = await Challenge.findById(created.body.data.id).lean();
      expect(fresh.status).toBe('removed');
      expect(fresh.removedReason).toBe('مخالف لسياسة المحتوى');

      const audit = await AuditLog.findOne({
        action: 'challenge.remove',
        targetId: fresh._id,
      }).lean();
      expect(audit).toBeTruthy();
    });
  });

  describe('public comments & moderation', () => {
    it('posts, reports, hides, restores and removes comments with visibility rules', async () => {
      await publishShowcase();

      const created = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/public-comments`),
        tokens.student
      ).send({ text: 'سؤال: كيف يعمل التطبيق دون إنترنت؟' });
      expect(created.status).toBe(201);
      expect(created.body.data.state).toBe(PUBLIC_COMMENT_STATES.VISIBLE);

      const commentId = created.body.data.id;

      const listBefore = await request(app).get(
        '/api/v1/public/projects/smart-campus-navigation/comments'
      );
      expect(listBefore.status).toBe(200);
      expect(listBefore.body.data).toHaveLength(1);
      expect(listBefore.body.data[0].author.name).toBe('طالب ناخب');

      const reported = await withAuth(
        request(app).post(`/api/v1/public-comments/${commentId}/report`),
        tokens.visitor
      ).send({ reason: 'محتوى غير مناسب' });
      expect(reported.status).toBe(201);
      let stored = await PublicComment.findById(commentId).lean();
      expect(stored.reports).toHaveLength(1);

      const memberHide = await withAuth(
        request(app).post(`/api/v1/public-comments/${commentId}/moderate`),
        tokens.member
      ).send({ action: 'hide' });
      expect(memberHide.status).toBe(200);
      expect(memberHide.body.data.state).toBe(PUBLIC_COMMENT_STATES.HIDDEN);

      const listHidden = await request(app).get(
        '/api/v1/public/projects/smart-campus-navigation/comments'
      );
      expect(listHidden.body.data).toHaveLength(0);

      const restored = await withAuth(
        request(app).post(`/api/v1/public-comments/${commentId}/moderate`),
        tokens.leader
      ).send({ action: 'restore' });
      expect(restored.status).toBe(200);
      expect(restored.body.data.state).toBe(PUBLIC_COMMENT_STATES.VISIBLE);

      const outsiderModeration = await withAuth(
        request(app).post(`/api/v1/public-comments/${commentId}/moderate`),
        tokens.collegeAdminB
      ).send({ action: 'remove', reason: 'خارج نطاق الكلية' });
      expect(outsiderModeration.status).toBe(404);

      const removed = await withAuth(
        request(app).post(`/api/v1/public-comments/${commentId}/moderate`),
        tokens.collegeAdminA
      ).send({ action: 'remove', reason: 'مخالفة سياسة النقاش' });
      expect(removed.status).toBe(200);
      expect(removed.body.data.state).toBe(PUBLIC_COMMENT_STATES.REMOVED);

      stored = await PublicComment.findById(commentId).lean();
      expect(stored.moderatedBy.toString()).toBe(users.collegeAdminA._id.toString());
    });

    it('rejects public comments on unpublished pages', async () => {
      const res = await withAuth(
        request(app).post(`/api/v1/projects/${project._id}/public-comments`),
        tokens.student
      ).send({ text: 'تعليق على صفحة غير منشورة' });
      expect(res.status).toBe(404);
    });
  });
});
