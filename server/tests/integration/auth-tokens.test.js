import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import User from '../../src/modules/auth/user.model.js';
import RefreshToken from '../../src/modules/auth/refreshToken.model.js';
import {
  hashPassword,
  issueSessionTokens,
  signAccessToken,
} from '../../src/core/auth/tokens.js';

const CLIENT_ORIGIN = 'http://localhost:5173';

function extractCookieValue(setCookieHeaders, cookieName) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const target = list.find((entry) => typeof entry === 'string' && entry.startsWith(`${cookieName}=`));
  if (!target) return null;
  const pair = target.split(';')[0];
  return pair.slice(cookieName.length + 1);
}

describe('Auth Tokens, Refresh Rotation & mustChangePassword Integration', () => {
  let app;
  let activeUser;

  beforeEach(async () => {
    app = createApp();
    const passwordHash = await hashPassword('Secret1234');
    activeUser = await User.create({
      name: 'أحمد محمد',
      email: 'ahmed@mnu.edu.eg',
      studentId: '20260001',
      passwordHash,
      status: 'active',
      accountType: 'student',
      roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.SELF }],
    });
  });

  it('rotates refresh cookies with HttpOnly, Secure, SameSite=None and rejects CSRF without X-Requested-With', async () => {
    const { refreshToken } = await issueSessionTokens(activeUser, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    // Missing X-Requested-With header must be rejected with 403 FORBIDDEN
    const csrfBlocked = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', CLIENT_ORIGIN)
      .set('Cookie', [`spp_rt=${refreshToken}`]);
    expect(csrfBlocked.status).toBe(403);
    expect(csrfBlocked.body.error.code).toBe('FORBIDDEN');

    // Disallowed origin must be rejected
    const badOrigin = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example.com')
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${refreshToken}`]);
    expect(badOrigin.status).toBe(403);

    // Valid refresh rotates cookie and returns new accessToken
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', CLIENT_ORIGIN)
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${refreshToken}`]);

    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));

    const setCookieHeader = rotated.headers['set-cookie'];
    const rawCookieLine = setCookieHeader.find((c) => c.startsWith('spp_rt='));
    expect(rawCookieLine).toContain('HttpOnly');
    expect(rawCookieLine).toContain('Secure');
    expect(rawCookieLine).toContain('SameSite=None');
    expect(rawCookieLine).toContain('Path=/api/v1/auth');

    const newRefreshToken = extractCookieValue(setCookieHeader, 'spp_rt');
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken);

    // Reusing the already-rotated refresh token must revoke the entire token family
    const reuseAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', CLIENT_ORIGIN)
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${refreshToken}`]);
    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe('UNAUTHENTICATED');

    // Now even the newer token in the same family must be rejected
    const familyRevokedCheck = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', CLIENT_ORIGIN)
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${newRefreshToken}`]);
    expect(familyRevokedCheck.status).toBe(401);
  });

  it('revokes refresh token and clears cookie on logout', async () => {
    const { refreshToken } = await issueSessionTokens(activeUser, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', CLIENT_ORIGIN)
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${refreshToken}`]);

    expect(logoutRes.status).toBe(204);
    const activeTokens = await RefreshToken.find({ userId: activeUser._id, revokedAt: null });
    expect(activeTokens).toHaveLength(0);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', CLIENT_ORIGIN)
      .set('X-Requested-With', 'spp')
      .set('Cookie', [`spp_rt=${refreshToken}`]);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('enforces tokenVersion revocation and mustChangePassword restriction on protected routes', async () => {
    const tokenV1 = signAccessToken(activeUser);

    // Valid token reaches /uploads/sign validation (missing body -> 400 VALIDATION_ERROR, not 401)
    const validRes = await request(app)
      .post('/api/v1/uploads/sign')
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({});
    expect(validRes.status).toBe(400);

    // Bump tokenVersion -> old token rejected immediately with 401 UNAUTHENTICATED
    await User.updateOne({ _id: activeUser._id }, { $inc: { tokenVersion: 1 } });
    const revokedRes = await request(app)
      .post('/api/v1/uploads/sign')
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({});
    expect(revokedRes.status).toBe(401);
    expect(revokedRes.body.error.code).toBe('UNAUTHENTICATED');

    // mustChangePassword user is blocked from regular endpoints with 403 PASSWORD_CHANGE_REQUIRED
    const updatedUser = await User.findByIdAndUpdate(
      activeUser._id,
      { $set: { mustChangePassword: true } },
      { new: true }
    );
    const tempUserToken = signAccessToken(updatedUser);

    const blockedUpload = await request(app)
      .post('/api/v1/uploads/sign')
      .set('Authorization', `Bearer ${tempUserToken}`)
      .send({});
    expect(blockedUpload.status).toBe(403);
    expect(blockedUpload.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
