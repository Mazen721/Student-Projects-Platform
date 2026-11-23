import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';

const CLIENT_ORIGIN = 'http://localhost:5173';

describe('Demo quick-login Integration', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    const passwordHash = await hashPassword('Secret1234');
    await User.create([
      {
        name: 'أ.د. شريف خاطر',
        email: 'admin@mnu.edu.eg',
        passwordHash,
        status: 'active',
        accountType: 'staff',
        roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
      },
      {
        name: 'سارة علي حسن',
        email: 'sara@mnu.edu.eg',
        studentId: '20260001',
        passwordHash,
        status: 'active',
        accountType: 'student',
        roles: [{ role: ROLES.STUDENT, scopeType: SCOPE_TYPES.SELF }],
      },
      {
        name: 'ندى محمود العجمي',
        email: 'nada.visitor@gmail.com',
        passwordHash,
        status: 'active',
        accountType: 'visitor',
        roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
      },
    ]);
  });

  afterEach(() => {
    delete process.env.ENABLE_DEMO_LOGIN;
  });

  it('is fully hidden (404) while ENABLE_DEMO_LOGIN is not true', async () => {
    delete process.env.ENABLE_DEMO_LOGIN;

    const info = await request(app).get('/api/v1/auth/demo-login').set('Origin', CLIENT_ORIGIN);
    expect(info.status).toBe(404);

    const login = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'student_one' });
    expect(login.status).toBe(404);
  });

  it('lists the six demo accounts without leaking emails when enabled', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const info = await request(app).get('/api/v1/auth/demo-login').set('Origin', CLIENT_ORIGIN);
    expect(info.status).toBe(200);
    const accounts = info.body.data.accounts;
    expect(accounts.map((a) => a.key)).toEqual([
      'university_admin',
      'college_admin',
      'supervisor',
      'student_one',
      'student_two',
      'visitor',
    ]);
    for (const account of accounts) {
      expect(account.title).toEqual(expect.any(String));
      expect(account.title.length).toBeGreaterThan(0);
      expect(account.email).toBeUndefined();
    }
  });

  it('signs in as a seeded demo student and issues a session cookie', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'student_one' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('sara@mnu.edu.eg');
    expect(res.body.data.mustChangePassword).toBe(false);

    const setCookieHeader = res.headers['set-cookie'] || [];
    const cookieLine = setCookieHeader.find((c) => c.startsWith('spp_rt='));
    expect(cookieLine).toBeTruthy();
    expect(cookieLine).toContain('HttpOnly');

    // The issued access token authenticates /auth/me
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Origin', CLIENT_ORIGIN)
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('sara@mnu.edu.eg');
  });

  it('signs in as the university admin and the visitor', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const admin = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'university_admin' });
    expect(admin.status).toBe(200);
    expect(admin.body.data.user.email).toBe('admin@mnu.edu.eg');

    const visitor = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'visitor' });
    expect(visitor.status).toBe(200);
    expect(visitor.body.data.user.email).toBe('nada.visitor@gmail.com');
  });

  it('returns 404 for a demo account that is not seeded in this database', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'college_admin' });
    expect(res.status).toBe(404);
  });

  it('rejects an unknown account key with a validation error', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await request(app)
      .post('/api/v1/auth/demo-login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ account: 'super_admin' });
    expect(res.status).toBe(400);
  });
});
