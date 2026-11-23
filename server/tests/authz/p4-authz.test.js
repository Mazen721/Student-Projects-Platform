import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHANNEL_KINDS, PROPOSAL_STATUSES, ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import Project from '../../src/modules/projects/project.model.js';
import Deliverable from '../../src/modules/tracking/deliverable.model.js';
import ProjectPhase from '../../src/modules/tracking/projectPhase.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';
import Channel from '../../src/modules/collaboration/channel.model.js';
import Message from '../../src/modules/collaboration/message.model.js';
import Comment from '../../src/modules/collaboration/comment.model.js';
import MediaAlbum from '../../src/modules/collaboration/mediaAlbum.model.js';
import MediaItem from '../../src/modules/collaboration/mediaItem.model.js';

describe('P4 Authorization Matrix (Collaboration & Media)', () => {
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
      name: 'مشرف أ',
      email: 'sup@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const outsiderSup = await createU({
      name: 'مشرف ب',
      email: 'supb@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeB._id,
      departmentId: deptB._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB._id, collegeId: collegeB._id, departmentId: deptB._id }],
    });
    const studentTeam = await createU({
      name: 'طالب الفريق',
      email: 'st1@mnu.edu.eg',
      studentId: '2026701',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA._id, collegeId: collegeA._id, departmentId: deptA._id }],
    });
    const outsiderStudent = await createU({
      name: 'طالب خارجي',
      email: 'st2@mnu.edu.eg',
      studentId: '2026702',
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
      title: 'مشروع صلاحيات التواصل',
      slug: 'collab-authz-project',
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
      team: {
        leaderId: studentTeam._id,
        members: [{ userId: studentTeam._id, role: 'leader', status: 'active' }],
      },
      activeMemberIds: [studentTeam._id],
      supervision: { primaryId: primarySup._id },
      supervisorIds: [primarySup._id],
    });

    const phase = await ProjectPhase.create({
      projectId: project._id,
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
      templateId: tpl._id,
      key: 'p1',
      name: 'مرحلة',
      order: 1,
      weight: 100,
      dueDate: new Date('2027-01-01'),
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

    const groupChannel = await Channel.create({
      projectId: project._id,
      kind: CHANNEL_KINDS.PROJECT_GROUP,
      memberIds: [studentTeam._id, primarySup._id],
      members: [{ userId: studentTeam._id }, { userId: primarySup._id }],
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
    });

    const teamOnlyChannel = await Channel.create({
      projectId: project._id,
      kind: CHANNEL_KINDS.TEAM_ONLY,
      memberIds: [studentTeam._id],
      members: [{ userId: studentTeam._id }],
      collegeId: collegeA._id,
      departmentId: deptA._id,
      academicYearId: ayA._id,
    });

    const groupMsg = await Message.create({
      channelId: groupChannel._id,
      senderId: studentTeam._id,
      text: 'رسالة جماعية للاختبار',
      textNormalized: 'رسالة جماعية للاختبار',
    });

    const comment = await Comment.create({
      targetType: 'deliverable',
      targetId: deliverable._id,
      projectId: project._id,
      authorId: studentTeam._id,
      text: 'تعليق للاختبار',
    });

    const album = await MediaAlbum.create({
      projectId: project._id,
      title: 'ألبوم أولي',
      order: 1,
    });

    const mediaItem = await MediaItem.create({
      albumId: album._id,
      projectId: project._id,
      kind: 'video_link',
      link: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      visibility: 'private',
      createdBy: studentTeam._id,
    });

    tokens = {
      collegeAdminA: signAccessToken(collegeAdminA),
      collegeAdminB: signAccessToken(collegeAdminB),
      deptAdminA: signAccessToken(deptAdminA),
      primarySup: signAccessToken(primarySup),
      outsiderSup: signAccessToken(outsiderSup),
      studentTeam: signAccessToken(studentTeam),
      outsiderStudent: signAccessToken(outsiderStudent),
    };

    resources = {
      projectId: String(project._id),
      collegeBId: String(collegeB._id),
      supervisorId: String(primarySup._id),
      deliverableId: String(deliverable._id),
      groupChannelId: String(groupChannel._id),
      teamOnlyChannelId: String(teamOnlyChannel._id),
      groupMsgId: String(groupMsg._id),
      commentId: String(comment._id),
      albumId: String(album._id),
      mediaItemId: String(mediaItem._id),
    };
  });

  const cases = [
    [
      'channel.list (project)',
      () => ({ method: 'get', path: `/api/v1/projects/${resources.projectId}/channels` }),
      'studentTeam',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'channel.createDirect',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.projectId}/channels/direct`,
        body: { supervisorId: resources.supervisorId },
      }),
      'studentTeam',
      [200, 201],
      'outsiderStudent',
      404,
    ],
    [
      'channel.read (group)',
      () => ({ method: 'get', path: `/api/v1/channels/${resources.groupChannelId}/messages` }),
      'primarySup',
      [200],
      'outsiderSup',
      404,
    ],
    [
      'channel.read (team_only blocks supervisor)',
      () => ({ method: 'get', path: `/api/v1/channels/${resources.teamOnlyChannelId}/messages` }),
      'studentTeam',
      [200],
      'primarySup',
      404,
    ],
    [
      'channel.write (team_only blocks supervisor)',
      () => ({
        method: 'post',
        path: `/api/v1/channels/${resources.teamOnlyChannelId}/messages`,
        body: { text: 'رسالة اختبار' },
      }),
      'studentTeam',
      [201],
      'primarySup',
      404,
    ],
    [
      'content.moderate (message)',
      () => ({
        method: 'post',
        path: `/api/v1/messages/${resources.groupMsgId}/remove`,
        body: { reason: 'مخالفة قواعد النشر' },
      }),
      'deptAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'comment.read',
      () => ({
        method: 'get',
        path: `/api/v1/comments?targetType=deliverable&targetId=${resources.deliverableId}`,
      }),
      'primarySup',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'comment.create',
      () => ({
        method: 'post',
        path: '/api/v1/comments',
        body: { targetType: 'deliverable', targetId: resources.deliverableId, text: 'ملاحظة جديدة' },
      }),
      'primarySup',
      [201],
      'outsiderStudent',
      404,
    ],
    [
      'content.moderate (comment)',
      () => ({
        method: 'post',
        path: `/api/v1/comments/${resources.commentId}/remove`,
        body: { reason: 'تعليق مخالف' },
      }),
      'collegeAdminA',
      [200],
      'collegeAdminB',
      404,
    ],
    [
      'announcement.create (collection & cross-college)',
      () => ({
        method: 'post',
        path: '/api/v1/announcements',
        body: { scopeType: 'college', scopeId: resources.collegeBId, title: 'إعلان تجريبي', body: 'نص الإعلان الكامل للطلاب' },
      }),
      'collegeAdminB',
      [201],
      'studentTeam',
      403,
    ],
    [
      'media.read',
      () => ({ method: 'get', path: `/api/v1/projects/${resources.projectId}/albums` }),
      'primarySup',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'media.write (album)',
      () => ({
        method: 'post',
        path: `/api/v1/projects/${resources.projectId}/albums`,
        body: { title: 'ألبوم صور' },
      }),
      'studentTeam',
      [201],
      'primarySup',
      404,
    ],
    [
      'media.write (update item)',
      () => ({
        method: 'patch',
        path: `/api/v1/media-items/${resources.mediaItemId}`,
        body: { visibility: 'public' },
      }),
      'studentTeam',
      [200],
      'outsiderStudent',
      404,
    ],
    [
      'mediaItem.remove (admin moderation)',
      () => ({
        method: 'post',
        path: `/api/v1/media-items/${resources.mediaItemId}/remove`,
        body: { reason: 'محتوى غير ملائم' },
      }),
      'deptAdminA',
      [200],
      'collegeAdminB',
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
