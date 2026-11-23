import http from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import ar from '@spp/shared/locales/ar';
import cloudinary from '../../src/config/cloudinary.js';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import Notification from '../../src/core/notifications/notification.model.js';
import { hashPassword, signAccessToken } from '../../src/core/auth/tokens.js';
import { initSocket } from '../../src/realtime/socket.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';
import PhaseTemplate from '../../src/modules/tracking/phaseTemplate.model.js';
import Deliverable from '../../src/modules/tracking/deliverable.model.js';
import Task from '../../src/modules/tracking/task.model.js';

async function signAndBuildUploadResult(app, token, { purpose, projectId, fileName, mimeType, bytes }) {
  const signRes = await request(app)
    .post('/api/v1/uploads/sign')
    .set('Authorization', `Bearer ${token}`)
    .send({ purpose, projectId, fileName, mimeType, bytes });
  expect(signRes.status).toBe(200);
  const s = signRes.body.data;
  const fullPublicId = `${s.folder}/${s.publicId}`;
  const version = 1795000101;
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

function connectClient(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const client = createSocketClient(baseUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', (err) => reject(err));
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res));
  });
}

describe('Collaboration, Chat, Notifications & Media Integration (P4 / US4)', () => {
  let app;
  let httpServer;
  let ioServer;
  let baseUrl;
  let openClients = [];

  let collegeA;
  let collegeB;
  let deptA1;
  let deptB1;
  let users;
  let tokens;

  beforeEach(async () => {
    app = createApp();
    httpServer = http.createServer(app);
    ioServer = initSocket(httpServer);
    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    collegeA = await College.create({
      name: 'كلية الهندسة',
      code: 'ENG',
      settings: { teamSizeMin: 1, teamSizeMax: 5 },
    });
    collegeB = await College.create({
      name: 'كلية الحاسبات',
      code: 'CS',
      settings: { teamSizeMin: 1, teamSizeMax: 5 },
    });
    deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    deptB1 = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    const now = Date.now();
    await AcademicYear.create({
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

    await PhaseTemplate.create({
      collegeId: collegeA._id,
      name: 'قالب افتراضي',
      isDefault: true,
      phases: [
        {
          key: 'impl',
          name: 'التنفيذ',
          order: 1,
          weight: 100,
          dueOffsetDays: 30,
          requiredDeliverables: [{ key: 'srs', title: 'وثيقة المتطلبات', allowedTypes: ['pdf'] }],
        },
      ],
    });

    const pw = await hashPassword('Password123');
    const createU = (doc) => User.create({ passwordHash: pw, status: USER_STATUSES.ACTIVE, ...doc });

    const collegeAdmin = await createU({
      name: 'عميد الهندسة',
      email: 'dean.eng@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });
    const deptAdmin = await createU({
      name: 'رئيس القسم',
      email: 'dept.ce@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.DEPARTMENT_ADMIN, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const supervisor = await createU({
      name: 'د. محمد المشرف',
      email: 'sup.eng@mnu.edu.eg',
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const leader = await createU({
      name: 'سارة القائدة',
      email: 'sara@mnu.edu.eg',
      studentId: '2026601',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const member = await createU({
      name: 'أحمد العضو',
      email: 'ahmed@mnu.edu.eg',
      studentId: '2026602',
      accountType: 'student',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptA1._id, collegeId: collegeA._id, departmentId: deptA1._id }],
    });
    const outsider = await createU({
      name: 'طالب خارجي',
      email: 'out@mnu.edu.eg',
      studentId: '2026603',
      accountType: 'student',
      collegeId: collegeB._id,
      departmentId: deptB1._id,
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.DEPARTMENT, scopeId: deptB1._id, collegeId: collegeB._id, departmentId: deptB1._id }],
    });

    users = { collegeAdmin, deptAdmin, supervisor, leader, member, outsider };
    tokens = {
      collegeAdmin: signAccessToken(collegeAdmin),
      deptAdmin: signAccessToken(deptAdmin),
      supervisor: signAccessToken(supervisor),
      leader: signAccessToken(leader),
      member: signAccessToken(member),
      outsider: signAccessToken(outsider),
    };
  });

  afterEach(async () => {
    for (const c of openClients) {
      c.disconnect();
    }
    openClients = [];
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(() => resolve()));
    } else if (httpServer) {
      await new Promise((resolve) => httpServer.close(() => resolve()));
    }
  });

  async function createApprovedProject() {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({
        title: 'نظام ذكي للمواصلات الجامعية',
        idea: 'تطبيق لتنسيق رحلات الحافلات الذكية داخل الجامعة',
        problem: 'تأخر الحافلات وصعوبة معرفة مواعيد الوصول',
        objectives: ['تتبع الحافلات', 'إرسال تنبيهات فورية'],
        scope: 'الحرم الجامعي',
        field: 'ai',
        type: 'software',
        beneficiaries: 'الطلاب والموظفون',
        expectedOutcomes: 'تطبيق متكامل مع لوحة متابعة',
        keywords: ['نقل', 'حافلات'],
        preferredSupervisorId: String(users.supervisor._id),
      });
    expect(createRes.status).toBe(201);
    const projectId = createRes.body.data.id;

    const invRes = await request(app)
      .post(`/api/v1/projects/${projectId}/team/invitations`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ inviteeId: String(users.member._id) });
    expect(invRes.status).toBe(201);

    const accRes = await request(app)
      .post(`/api/v1/team-invitations/${invRes.body.data._id}/accept`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({});
    expect(accRes.status).toBe(200);

    await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ reviewerId: String(users.supervisor._id) });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ event: 'SUBMIT' });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supervisor}`)
      .send({ event: 'START_REVIEW' });

    await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.supervisor}`)
      .send({ event: 'RECOMMEND', comment: 'مقترح ممتاز' });

    const approveRes = await request(app)
      .post(`/api/v1/projects/${projectId}/transitions`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ event: 'APPROVE', comment: 'معتمد رسمياً' });
    expect(approveRes.status).toBe(200);

    await request(app)
      .put(`/api/v1/projects/${projectId}/supervision`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ primaryId: String(users.supervisor._id) });

    return projectId;
  }

  it('provisions group and team_only channels on approval, isolates team_only from supervisors, and supports direct messaging', async () => {
    const projectId = await createApprovedProject();

    const memberChannelsRes = await request(app)
      .get(`/api/v1/projects/${projectId}/channels`)
      .set('Authorization', `Bearer ${tokens.leader}`);
    expect(memberChannelsRes.status).toBe(200);
    const memberKinds = memberChannelsRes.body.data.map((c) => c.kind).sort();
    expect(memberKinds).toEqual(['project_group', 'team_only']);

    const supChannelsRes = await request(app)
      .get(`/api/v1/projects/${projectId}/channels`)
      .set('Authorization', `Bearer ${tokens.supervisor}`);
    expect(supChannelsRes.status).toBe(200);
    expect(supChannelsRes.body.data.map((c) => c.kind)).toEqual(['project_group']);

    const teamOnlyId = memberChannelsRes.body.data.find((c) => c.kind === 'team_only').id;

    // Supervisor denied access to team_only over REST and Socket.IO
    const supTeamMessagesRes = await request(app)
      .get(`/api/v1/channels/${teamOnlyId}/messages`)
      .set('Authorization', `Bearer ${tokens.supervisor}`);
    expect(supTeamMessagesRes.status).toBe(404);

    const supSocket = await connectClient(baseUrl, tokens.supervisor);
    openClients.push(supSocket);
    const joinDenied = await emitWithAck(supSocket, 'channel:join', { channelId: teamOnlyId });
    expect(joinDenied.ok).toBe(false);
    expect(joinDenied.error.code).toBe('NOT_FOUND');

    // Direct channel student <-> own supervisor (201 then 200 idempotent)
    const directCreateRes = await request(app)
      .post(`/api/v1/projects/${projectId}/channels/direct`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ supervisorId: String(users.supervisor._id) });
    expect(directCreateRes.status).toBe(201);
    expect(directCreateRes.body.data.kind).toBe('direct');

    const directExistingRes = await request(app)
      .post(`/api/v1/projects/${projectId}/channels/direct`)
      .set('Authorization', `Bearer ${tokens.supervisor}`)
      .send({ studentId: String(users.leader._id) });
    expect(directExistingRes.status).toBe(200);
    expect(directExistingRes.body.data.id).toBe(directCreateRes.body.data.id);
  });

  it('delivers Socket.IO messages < 2s p95 with attachments, replies, isolated mentions, read receipts, search, and admin tombstone moderation', async () => {
    const projectId = await createApprovedProject();

    const channelsRes = await request(app)
      .get(`/api/v1/projects/${projectId}/channels`)
      .set('Authorization', `Bearer ${tokens.leader}`);
    const groupChannel = channelsRes.body.data.find((c) => c.kind === 'project_group');
    const teamOnlyChannel = channelsRes.body.data.find((c) => c.kind === 'team_only');

    const leaderSocket = await connectClient(baseUrl, tokens.leader);
    const memberSocket = await connectClient(baseUrl, tokens.member);
    const supSocket = await connectClient(baseUrl, tokens.supervisor);
    openClients.push(leaderSocket, memberSocket, supSocket);

    expect((await emitWithAck(leaderSocket, 'channel:join', { channelId: groupChannel.id })).ok).toBe(true);
    expect((await emitWithAck(memberSocket, 'channel:join', { channelId: groupChannel.id })).ok).toBe(true);
    expect((await emitWithAck(supSocket, 'channel:join', { channelId: groupChannel.id })).ok).toBe(true);
    expect((await emitWithAck(leaderSocket, 'channel:join', { channelId: teamOnlyChannel.id })).ok).toBe(true);

    // Measure p95 latency across 15 real-time messages (SC-006 < 2000ms)
    const latencies = [];
    for (let i = 0; i < 15; i += 1) {
      const started = performance.now();
      const receivedPromise = new Promise((resolve) => {
        const handler = (msg) => {
          if (msg.text === `رسالة سريعة ${i}`) {
            memberSocket.off('message:new', handler);
            resolve(performance.now() - started);
          }
        };
        memberSocket.on('message:new', handler);
      });

      const ack = await emitWithAck(leaderSocket, 'message:send', {
        channelId: groupChannel.id,
        clientId: `c-${i}`,
        text: `رسالة سريعة ${i}`,
      });
      expect(ack.ok).toBe(true);
      expect(ack.clientId).toBe(`c-${i}`);
      latencies.push(await receivedPromise);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95) - 1];
    expect(p95).toBeLessThan(2000);

    // Send attachment + reply + @mention (with outsider & supervisor in team_only isolation check)
    const attachment = await signAndBuildUploadResult(app, tokens.leader, {
      purpose: 'chat',
      projectId,
      fileName: 'diagram.png',
      mimeType: 'image/png',
      bytes: 2048,
    });

    const firstAck = await emitWithAck(leaderSocket, 'message:send', {
      channelId: groupChannel.id,
      clientId: 'with-attachment',
      text: 'مراجعة التصميم المعماري للنظام',
      attachments: [attachment],
      mentions: [String(users.member._id), String(users.outsider._id)],
    });
    expect(firstAck.ok).toBe(true);
    expect(firstAck.message.attachments).toHaveLength(1);

    // Outsider must NOT receive mention notification; member MUST receive it
    const memberMentionNotif = await Notification.findOne({
      userId: users.member._id,
      type: 'chat_mention',
    }).lean();
    const outsiderMentionNotif = await Notification.findOne({
      userId: users.outsider._id,
      type: 'chat_mention',
    }).lean();
    expect(memberMentionNotif).toBeTruthy();
    expect(outsiderMentionNotif).toBeNull();

    // Mentioning supervisor inside team_only must NOT notify supervisor
    const teamAck = await emitWithAck(leaderSocket, 'message:send', {
      channelId: teamOnlyChannel.id,
      clientId: 'team-mention-guard',
      text: 'رسالة خاصة بالفريق فقط',
      mentions: [String(users.supervisor._id)],
    });
    expect(teamAck.ok).toBe(true);
    const supMentionNotif = await Notification.findOne({
      userId: users.supervisor._id,
      type: 'chat_mention',
    }).lean();
    expect(supMentionNotif).toBeNull();

    // Read receipt
    const receiptPromise = new Promise((resolve) => {
      leaderSocket.once('receipt:update', (payload) => resolve(payload));
    });
    const readAck = await emitWithAck(memberSocket, 'message:read', {
      channelId: groupChannel.id,
      upToMessageId: firstAck.message.id,
    });
    expect(readAck.ok).toBe(true);
    const receipt = await receiptPromise;
    expect(receipt.userId).toBe(String(users.member._id));
    expect(receipt.upToMessageId).toBe(firstAck.message.id);

    // Search within channel (Arabic normalized, does not leak team_only messages)
    const searchGroupRes = await request(app)
      .get(`/api/v1/channels/${groupChannel.id}/search`)
      .query({ q: 'المعماري' })
      .set('Authorization', `Bearer ${tokens.supervisor}`);
    expect(searchGroupRes.status).toBe(200);
    expect(searchGroupRes.body.data.length).toBeGreaterThanOrEqual(1);

    const searchTeamBySupRes = await request(app)
      .get(`/api/v1/channels/${teamOnlyChannel.id}/search`)
      .query({ q: 'الفريق' })
      .set('Authorization', `Bearer ${tokens.supervisor}`);
    expect(searchTeamBySupRes.status).toBe(404);

    // Admin content moderation -> tombstone + socket message:removed + AuditLog
    const removedSocketPromise = new Promise((resolve) => {
      memberSocket.once('message:removed', (payload) => resolve(payload));
    });
    const removeRes = await request(app)
      .post(`/api/v1/messages/${firstAck.message.id}/remove`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ reason: 'محتوى غير مناسب للائحة' });
    expect(removeRes.status).toBe(200);
    const removedEvent = await removedSocketPromise;
    expect(removedEvent.messageId).toBe(firstAck.message.id);

    const historyAfterRemove = await request(app)
      .get(`/api/v1/channels/${groupChannel.id}/messages`)
      .set('Authorization', `Bearer ${tokens.leader}`);
    const tombstoned = historyAfterRemove.body.data.find((m) => m.id === firstAck.message.id);
    expect(tombstoned.isRemoved).toBe(true);
    expect(tombstoned.text).toBe(ar.chat.removedByAdmin);

    const modAudit = await AuditLog.findOne({
      action: 'message.remove',
      targetId: new mongoose.Types.ObjectId(firstAck.message.id),
    }).lean();
    expect(modAudit).toBeTruthy();
  });

  it('supports deliverable/task comment threads, scoped announcements fan-out, notification center, and private/public media albums', async () => {
    const projectId = await createApprovedProject();
    const deliverable = await Deliverable.findOne({ projectId }).lean();
    const task = await Task.create({
      projectId,
      title: 'مهمة واجهة المحادثة',
      column: 'todo',
      order: 'a0',
      createdBy: users.leader._id,
    });

    // Comments on deliverable & task
    const commentRes = await request(app)
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${tokens.supervisor}`)
      .send({
        targetType: 'deliverable',
        targetId: String(deliverable._id),
        text: 'يرجى توضيح متطلبات الأمان في الفصل الثالث',
        mentions: [String(users.leader._id)],
      });
    expect(commentRes.status).toBe(201);

    const replyRes = await request(app)
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({
        targetType: 'deliverable',
        targetId: String(deliverable._id),
        parentId: commentRes.body.data.id,
        text: 'تمت إضافة جدول المتطلبات',
      });
    expect(replyRes.status).toBe(201);

    const threadRes = await request(app)
      .get('/api/v1/comments')
      .query({ targetType: 'deliverable', targetId: String(deliverable._id) })
      .set('Authorization', `Bearer ${tokens.member}`);
    expect(threadRes.status).toBe(200);
    expect(threadRes.body.data).toHaveLength(2);

    const taskCommentRes = await request(app)
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({
        targetType: 'task',
        targetId: String(task._id),
        text: 'بدأت في تجهيز التصميم',
      });
    expect(taskCommentRes.status).toBe(201);

    // Scoped announcement by supervisor (supervision scope)
    const annRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${tokens.supervisor}`)
      .send({
        scopeType: 'supervision',
        title: 'موعد المتابعة الأسبوعي',
        body: 'يرجى رفع آخر تحديث قبل يوم الخميس الساعة الخامسة.',
      });
    expect(annRes.status).toBe(201);
    expect(annRes.body.data.audienceCount).toBe(2);

    const memberAnnList = await request(app)
      .get('/api/v1/announcements')
      .set('Authorization', `Bearer ${tokens.member}`);
    expect(memberAnnList.status).toBe(200);
    expect(memberAnnList.body.data).toHaveLength(1);

    const outsiderAnnList = await request(app)
      .get('/api/v1/announcements')
      .set('Authorization', `Bearer ${tokens.outsider}`);
    expect(outsiderAnnList.status).toBe(200);
    expect(outsiderAnnList.body.data).toHaveLength(0);

    // Notification center list + mark-read
    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .query({ unread: 'true' })
      .set('Authorization', `Bearer ${tokens.leader}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    const markReadRes = await request(app)
      .post('/api/v1/notifications/read')
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ all: true });
    expect(markReadRes.status).toBe(204);

    const notifAfterRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokens.leader}`);
    expect(notifAfterRes.body.unreadCount).toBe(0);

    // Media albums: photo (default private) + YouTube link + visibility toggle + admin removal
    const albumRes = await request(app)
      .post(`/api/v1/projects/${projectId}/albums`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ title: 'صور النموذج الأولي' });
    expect(albumRes.status).toBe(201);
    const albumId = albumRes.body.data.id;

    const photoUpload = await signAndBuildUploadResult(app, tokens.leader, {
      purpose: 'gallery',
      projectId,
      fileName: 'prototype.jpg',
      mimeType: 'image/jpeg',
      bytes: 4096,
    });
    const photoItemRes = await request(app)
      .post(`/api/v1/albums/${albumId}/items`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({
        kind: 'photo',
        upload: photoUpload,
        caption: 'واجهة النظام الرئيسية',
      });
    expect(photoItemRes.status).toBe(201);
    expect(photoItemRes.body.data.visibility).toBe('private');

    const videoItemRes = await request(app)
      .post(`/api/v1/albums/${albumId}/items`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({
        kind: 'video_link',
        link: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'عرض توضيحي' },
        visibility: 'public',
      });
    expect(videoItemRes.status).toBe(201);

    const toggleRes = await request(app)
      .patch(`/api/v1/media-items/${photoItemRes.body.data.id}`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ visibility: 'public' });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.visibility).toBe('public');

    const albumsListRes = await request(app)
      .get(`/api/v1/projects/${projectId}/albums`)
      .set('Authorization', `Bearer ${tokens.supervisor}`);
    expect(albumsListRes.status).toBe(200);
    expect(albumsListRes.body.data[0].items).toHaveLength(2);
    expect(albumsListRes.body.data[0].items[0].signedUrl).toBeTruthy();

    const adminRemoveMedia = await request(app)
      .post(`/api/v1/media-items/${photoItemRes.body.data.id}/remove`)
      .set('Authorization', `Bearer ${tokens.deptAdmin}`)
      .send({ reason: 'صورة مخالفة' });
    expect(adminRemoveMedia.status).toBe(200);
    const mediaAudit = await AuditLog.findOne({
      action: 'mediaItem.remove',
      targetId: new mongoose.Types.ObjectId(photoItemRes.body.data.id),
    }).lean();
    expect(mediaAudit).toBeTruthy();
  });
});
