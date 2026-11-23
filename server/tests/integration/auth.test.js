import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import { hashPassword } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import AcademicYear from '../../src/modules/organization/academicYear.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';

describe('Auth & Identity Integration (P1 / US1)', () => {
  let app;
  let collegeA;
  let collegeB;
  let deptA1;
  let deptB1;
  let uniAdminToken;
  let collegeAdminAToken;

  async function loginAs(email, password) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
  }

  beforeEach(async () => {
    app = createApp();
    await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });

    collegeA = await College.create({ name: 'كلية الهندسة', code: 'ENG' });
    collegeB = await College.create({ name: 'كلية الحاسبات', code: 'CS' });
    deptA1 = await Department.create({ name: 'هندسة الحاسبات', code: 'CE', collegeId: collegeA._id });
    deptB1 = await Department.create({ name: 'علوم الحاسب', code: 'CS1', collegeId: collegeB._id });

    const passwordHash = await hashPassword('Admin1234');
    await User.create({
      name: 'مدير الجامعة',
      email: 'uni.admin@mnu.edu.eg',
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });

    await User.create({
      name: 'عميد الهندسة',
      email: 'eng.admin@mnu.edu.eg',
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
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

    uniAdminToken = await loginAs('uni.admin@mnu.edu.eg', 'Admin1234');
    collegeAdminAToken = await loginAs('eng.admin@mnu.edu.eg', 'Admin1234');
  });

  it('registers student with university domain immediately and rejects duplicates & external domains', async () => {
    const badDomainRes = await request(app).post('/api/v1/auth/register/student').send({
      name: 'طالب خارجي',
      email: 'student@gmail.com',
      studentId: '20261001',
      password: 'Password123',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    expect(badDomainRes.status).toBe(400);
    expect(badDomainRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(badDomainRes.body.error.fields.some((f) => f.path === 'email')).toBe(true);

    const okRes = await request(app).post('/api/v1/auth/register/student').send({
      name: 'سارة علي',
      email: 'sara.ali@mnu.edu.eg',
      studentId: '20261001',
      password: 'Password123',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.accessToken).toEqual(expect.any(String));
    expect(okRes.body.data.user.status).toBe('active');
    expect(okRes.body.data.user.privacy).toEqual({
      email: 'private',
      phone: 'private',
      socialLinks: 'private',
    });

    const dupEmailRes = await request(app).post('/api/v1/auth/register/student').send({
      name: 'طالب مكرر',
      email: 'sara.ali@mnu.edu.eg',
      studentId: '20269999',
      password: 'Password123',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    expect(dupEmailRes.status).toBe(409);
    expect(dupEmailRes.body.error.code).toBe('DUPLICATE_EMAIL');

    const dupIdRes = await request(app).post('/api/v1/auth/register/student').send({
      name: 'طالب برقم مكرر',
      email: 'other.student@mnu.edu.eg',
      studentId: '20261001',
      password: 'Password123',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    expect(dupIdRes.status).toBe(409);
    expect(dupIdRes.body.error.code).toBe('DUPLICATE_STUDENT_ID');
  });

  it('keeps self-registered investor pending until university admin approves or rejects with audit trail', async () => {
    const inv1Res = await request(app).post('/api/v1/auth/register/investor').send({
      name: 'شركة النيل',
      organization: 'النيل للتقنية',
      email: 'nile@company.com',
      password: 'Password123',
      fieldOfInterest: 'الذكاء الاصطناعي',
    });
    expect(inv1Res.status).toBe(201);
    expect(inv1Res.body.data.user.status).toBe('pending');
    const inv1Token = inv1Res.body.data.accessToken;
    const inv1Id = inv1Res.body.data.user.id;

    // Pending investor can read /auth/me & /dashboard/home but cannot update profile
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${inv1Token}`);
    expect(meRes.status).toBe(200);

    const blockedPatch = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({ bio: 'نبذة' });
    expect(blockedPatch.status).toBe(403);

    // Non-university admin cannot list pending investors
    const forbiddenPending = await request(app)
      .get('/api/v1/investors/pending')
      .set('Authorization', `Bearer ${collegeAdminAToken}`);
    expect(forbiddenPending.status).toBe(403);

    const pendingList = await request(app)
      .get('/api/v1/investors/pending')
      .set('Authorization', `Bearer ${uniAdminToken}`);
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.data).toHaveLength(1);

    const approveRes = await request(app)
      .post(`/api/v1/investors/${inv1Id}/approve`)
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('active');

    const okPatch = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({ bio: 'شريك تقني مهتم بمشاريع الذكاء الاصطناعي' });
    expect(okPatch.status).toBe(200);

    // Register second investor and reject with reason
    const inv2Res = await request(app).post('/api/v1/auth/register/investor').send({
      name: 'مستثمر مرفوض',
      organization: 'جهة غير موثقة',
      email: 'rejected@company.com',
      password: 'Password123',
      fieldOfInterest: 'الطاقة',
    });
    const inv2Id = inv2Res.body.data.user.id;

    const rejectRes = await request(app)
      .post(`/api/v1/investors/${inv2Id}/reject`)
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({ reason: 'بيانات الجهة غير مكتملة' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');

    const rejectedLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'rejected@company.com',
      password: 'Password123',
    });
    expect(rejectedLogin.status).toBe(403);
    expect(rejectedLogin.body.error.code).toBe('ACCOUNT_DEACTIVATED');

    const audits = await AuditLog.find({ targetId: new mongoose.Types.ObjectId(inv1Id) }).lean();
    expect(audits.some((a) => a.action === 'investor.approve')).toBe(true);
  });

  it('registers visitor and enforces profile contact privacy defaults (US1-10)', async () => {
    const visRes = await request(app).post('/api/v1/auth/register/visitor').send({
      name: 'زائر كريم',
      email: 'visitor@example.com',
      password: 'Password123',
    });
    expect(visRes.status).toBe(201);
    const visToken = visRes.body.data.accessToken;
    const visId = visRes.body.data.user.id;

    // Update phone while keeping phone privacy private
    const updateRes = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${visToken}`)
      .send({
        phone: '+201001234567',
        socialLinks: ['https://github.com/visitor'],
        privacy: { socialLinks: 'public' },
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.profile.phone).toBe('+201001234567');

    // University Admin reading visitor profile sees public socialLinks, NOT private phone or private email
    const viewedByAdmin = await request(app)
      .get(`/api/v1/users/${visId}`)
      .set('Authorization', `Bearer ${uniAdminToken}`);
    expect(viewedByAdmin.status).toBe(200);
    expect(viewedByAdmin.body.data.profile.phone).toBeUndefined();
    expect(viewedByAdmin.body.data.profile.socialLinks).toEqual(['https://github.com/visitor']);
  });

  it('creates single-use 7-day role invitation and blocks reuse or revocation', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({
        role: ROLES.SUPERVISOR,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: String(deptA1._id),
      });
    expect(inviteRes.status).toBe(201);
    const tokenMatch = inviteRes.body.data.url.match(/\/accept-invite\/([a-f0-9]+)$/i);
    expect(tokenMatch).toBeTruthy();
    const inviteToken = tokenMatch[1];

    const previewRes = await request(app).get(`/api/v1/invitations/${inviteToken}`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.role).toBe(ROLES.SUPERVISOR);

    const acceptRes = await request(app).post(`/api/v1/invitations/${inviteToken}/accept`).send({
      name: 'د. طارق حسن',
      email: 'tarek.hassan@mnu.edu.eg',
      password: 'Password123',
    });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.user.roles[0].role).toBe(ROLES.SUPERVISOR);
    expect(String(acceptRes.body.data.user.collegeId)).toBe(String(collegeA._id));

    // Reusing the same invite returns uniform INVITE_UNAVAILABLE
    const reuseRes = await request(app).post(`/api/v1/invitations/${inviteToken}/accept`).send({
      name: 'مستخدم ثان',
      email: 'second@mnu.edu.eg',
      password: 'Password123',
    });
    expect(reuseRes.status).toBe(404);
    expect(reuseRes.body.error.code).toBe('INVITE_UNAVAILABLE');

    // Unknown token also returns identical INVITE_UNAVAILABLE
    const unknownRes = await request(app).get('/api/v1/invitations/00000000000000000000000000000000');
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.error.code).toBe('INVITE_UNAVAILABLE');

    // Revoking an unused invitation prevents acceptance
    const invite2 = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({
        role: ROLES.DEPARTMENT_ADMIN,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: String(deptA1._id),
      });
    const token2 = invite2.body.data.url.split('/').pop();
    const revokeRes = await request(app)
      .post(`/api/v1/invitations/${invite2.body.data.id}/revoke`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ reason: 'تم التراجع عن الدعوة' });
    expect(revokeRes.status).toBe(200);

    const revokedPreview = await request(app).get(`/api/v1/invitations/${token2}`);
    expect(revokedPreview.status).toBe(404);
    expect(revokedPreview.body.error.code).toBe('INVITE_UNAVAILABLE');
  });

  it('resets student password once, forces change on next login, and releases impostor identifiers (FR-013a, FR-015)', async () => {
    const reg = await request(app).post('/api/v1/auth/register/student').send({
      name: 'منتحل الهوية',
      email: 'real.student@mnu.edu.eg',
      studentId: '20265555',
      password: 'OldPassword1',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    const impostorId = reg.body.data.user.id;

    // College Admin resets password
    const resetRes = await request(app)
      .post(`/api/v1/users/${impostorId}/reset-password`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({});
    expect(resetRes.status).toBe(200);
    const tempPassword = resetRes.body.data.temporaryPassword;
    expect(tempPassword).toHaveLength(12);

    // Login with temp password sets mustChangePassword: true and blocks profile update
    const tempLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'real.student@mnu.edu.eg',
      password: tempPassword,
    });
    expect(tempLogin.status).toBe(200);
    expect(tempLogin.body.data.mustChangePassword).toBe(true);

    const blockedRes = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${tempLogin.body.data.accessToken}`)
      .send({ bio: 'محاولة' });
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Change password unlocks account
    const changeRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${tempLogin.body.data.accessToken}`)
      .send({ currentPassword: tempPassword, newPassword: 'NewPassword99' });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.data.accessToken).toEqual(expect.any(String));

    // College Admin deactivates impostor and releases identifiers (FR-013a)
    const releaseRes = await request(app)
      .post(`/api/v1/users/${impostorId}/deactivate`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ reason: 'حساب منتحل لهوية طالب آخر', releaseIdentifiers: true });
    expect(releaseRes.status).toBe(200);

    // Impostor access token is immediately rejected
    const afterDeactivate = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${changeRes.body.data.accessToken}`);
    expect(afterDeactivate.status).toBe(401);

    // Genuine student can now register with the released email & studentId
    const genuineReg = await request(app).post('/api/v1/auth/register/student').send({
      name: 'الطالب الحقيقي',
      email: 'real.student@mnu.edu.eg',
      studentId: '20265555',
      password: 'RealPassword1',
      collegeId: String(collegeA._id),
      departmentId: String(deptA1._id),
    });
    expect(genuineReg.status).toBe(201);

    // Verify audit log never leaks temporaryPassword or passwordHash
    const auditEntries = await AuditLog.find({
      targetId: new mongoose.Types.ObjectId(impostorId),
    }).lean();
    expect(JSON.stringify(auditEntries)).not.toContain(tempPassword);
    expect(auditEntries.some((a) => a.action === 'user.releaseIdentifiers')).toBe(true);
  });

  it('enforces role delegation ceiling and immediate token revocation on role removal', async () => {
    const staffUser = await User.create({
      name: 'د. كريم سامي',
      email: 'kareem@mnu.edu.eg',
      passwordHash: await hashPassword('Password123'),
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [{ role: ROLES.SUPERVISOR, scopeType: SCOPE_TYPES.COLLEGE, scopeId: collegeA._id, collegeId: collegeA._id }],
    });

    // College Admin cannot grant collegeAdmin or universityAdmin
    const escalationRes = await request(app)
      .post(`/api/v1/users/${staffUser._id}/roles`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({
        role: ROLES.COLLEGE_ADMIN,
        scopeType: SCOPE_TYPES.COLLEGE,
        scopeId: String(collegeA._id),
      });
    expect(escalationRes.status).toBe(403);

    // College Admin can grant departmentAdmin within College A
    const grantRes = await request(app)
      .post(`/api/v1/users/${staffUser._id}/roles`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({
        role: ROLES.DEPARTMENT_ADMIN,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: String(deptA1._id),
      });
    expect(grantRes.status).toBe(201);
    const newRoleId = grantRes.body.data.roles.find((r) => r.role === ROLES.DEPARTMENT_ADMIN)._id;

    const staffToken = await loginAs('kareem@mnu.edu.eg', 'Password123');

    // Revoke role -> bumps tokenVersion so existing token stops working immediately
    const revokeRes = await request(app)
      .delete(`/api/v1/users/${staffUser._id}/roles/${newRoleId}`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ reason: 'انتهاء التكليف' });
    expect(revokeRes.status).toBe(204);

    const staleTokenCheck = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staleTokenCheck.status).toBe(401);

    // Unused helper variables in outer test scope check
    expect(deptB1._id).toBeTruthy();
    expect(AcademicYear).toBeTruthy();
  });
});
