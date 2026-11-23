import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { createApp } from '../../src/app.js';
import AuditLog from '../../src/core/audit/auditlog.model.js';
import { hashPassword } from '../../src/core/auth/tokens.js';
import User from '../../src/modules/auth/user.model.js';
import College from '../../src/modules/organization/college.model.js';
import Department from '../../src/modules/organization/department.model.js';
import University from '../../src/modules/organization/university.model.js';

async function buildExcelBuffer(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('Organization, Structure, Bulk Import & Scoped Audit Integration (P1 / US1)', () => {
  let app;
  let collegeA;
  let collegeB;
  let deptA1;
  let deptB1;
  let uniAdminToken;
  let collegeAdminAToken;
  let multiRoleToken;
  let multiRoleSupervisorId;
  let multiRoleDeptAdminId;

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

    const multiUser = await User.create({
      name: 'د. خالد متعدد الأدوار',
      email: 'khaled.multi@mnu.edu.eg',
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      collegeId: collegeA._id,
      departmentId: deptA1._id,
      roles: [
        {
          role: ROLES.SUPERVISOR,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA1._id,
          collegeId: collegeA._id,
          departmentId: deptA1._id,
        },
        {
          role: ROLES.DEPARTMENT_ADMIN,
          scopeType: SCOPE_TYPES.DEPARTMENT,
          scopeId: deptA1._id,
          collegeId: collegeA._id,
          departmentId: deptA1._id,
        },
      ],
    });

    multiRoleSupervisorId = String(multiUser.roles[0]._id);
    multiRoleDeptAdminId = String(multiUser.roles[1]._id);

    uniAdminToken = await loginAs('uni.admin@mnu.edu.eg', 'Admin1234');
    collegeAdminAToken = await loginAs('eng.admin@mnu.edu.eg', 'Admin1234');
    multiRoleToken = await loginAs('khaled.multi@mnu.edu.eg', 'Admin1234');
  });

  it('creates, updates, and deactivates colleges & departments while denying cross-college access with 404', async () => {
    const createCollege = await request(app)
      .post('/api/v1/colleges')
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({ name: 'كلية الصيدلة', code: 'PHARM' });
    expect(createCollege.status).toBe(201);
    const newCollegeId = createCollege.body.data._id;

    const createDept = await request(app)
      .post(`/api/v1/colleges/${newCollegeId}/departments`)
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({ name: 'الصيدلة الإكلينيكية', code: 'CLIN' });
    expect(createDept.status).toBe(201);

    // Cross-college edit denied with 404 NOT_FOUND and zero leakage (US1-2)
    const crossEdit = await request(app)
      .patch(`/api/v1/departments/${deptB1._id}`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ name: 'تعديل غير مصرح' });
    expect(crossEdit.status).toBe(404);
    expect(crossEdit.body.error.code).toBe('NOT_FOUND');

    // College A admin updates settings within college A
    const settingsRes = await request(app)
      .patch(`/api/v1/colleges/${collegeA._id}/settings`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ teamSizeMin: 2, teamSizeMax: 6, passMark: 60 });
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.data.settings.teamSizeMax).toBe(6);

    // Deactivate department preserves record
    const deactivateDept = await request(app)
      .post(`/api/v1/departments/${createDept.body.data._id}/deactivate`)
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({ reason: 'دمج القسم' });
    expect(deactivateDept.status).toBe(200);
    expect(deactivateDept.body.data.status).toBe('deactivated');
  });

  it('configures academic years, cycle windows, set-current, and rollover', async () => {
    const createAy1 = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/academic-years`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({
        label: '2025/2026',
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
        semesters: [
          { name: 'الفصل الأول', startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-01-20T00:00:00.000Z' },
        ],
        cycle: {
          registrationOpensAt: '2025-09-15T00:00:00.000Z',
          registrationClosesAt: '2025-10-15T00:00:00.000Z',
          proposalDeadline: '2025-10-30T00:00:00.000Z',
        },
      });
    expect(createAy1.status).toBe(201);

    const setCurr = await request(app)
      .post(`/api/v1/academic-years/${createAy1.body.data._id}/set-current`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({});
    expect(setCurr.status).toBe(200);
    expect(setCurr.body.data.isCurrent).toBe(true);

    const rolloverRes = await request(app)
      .post(`/api/v1/academic-years/${createAy1.body.data._id}/rollover`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({});
    expect(rolloverRes.status).toBe(200);
    expect(rolloverRes.body.data.academicYear.status).toBe('archived');
    expect(rolloverRes.body.data.archivedProjects).toBe(0);
  });

  it('bulk-imports students from Excel with partial success, credentials sheet, and bad-template rejection (US1-8)', async () => {
    // Download template
    const tplRes = await request(app)
      .get('/api/v1/imports/template?kind=students')
      .set('Authorization', `Bearer ${collegeAdminAToken}`);
    expect(tplRes.status).toBe(200);
    expect(tplRes.headers['content-type']).toContain('spreadsheetml');

    // Wrong headers -> 400 IMPORT_BAD_TEMPLATE
    const badHeadersBuf = await buildExcelBuffer(['wrong', 'headers'], [['a', 'b']]);
    const badImport = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/imports?kind=students`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .attach('file', badHeadersBuf, 'bad.xlsx');
    expect(badImport.status).toBe(400);
    expect(badImport.body.error.code).toBe('IMPORT_BAD_TEMPLATE');

    // Valid template with 2 valid rows and 3 invalid rows (bad domain, unknown dept, duplicate studentId)
    const validHeaders = ['الاسم الكامل', 'البريد الإلكتروني', 'الرقم الجامعي', 'رمز القسم'];
    const mixedBuf = await buildExcelBuffer(validHeaders, [
      ['محمد أحمد', 'm.ahmed@mnu.edu.eg', '20260101', 'CE'],
      ['نور هاني', 'n.hany@mnu.edu.eg', '20260102', 'CE'],
      ['بريد خارجي', 'ext@gmail.com', '20260103', 'CE'],
      ['قسم خاطئ', 'bad.dept@mnu.edu.eg', '20260104', 'UNKNOWN'],
      ['رقم مكرر', 'dup.id@mnu.edu.eg', '20260101', 'CE'],
    ]);

    const importRes = await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/imports?kind=students`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .attach('file', mixedBuf, 'students.xlsx');

    expect(importRes.status).toBe(200);
    expect(importRes.headers['cache-control']).toBe('no-store');
    expect(importRes.body.data.created).toBe(2);
    expect(importRes.body.data.rejected).toHaveLength(3);
    expect(importRes.body.data.credentialsFile).toEqual(expect.any(String));

    // Verify created imported student has mustChangePassword: true
    const importedUser = await User.findOne({ email: 'm.ahmed@mnu.edu.eg' }).lean();
    expect(importedUser).toBeTruthy();
    expect(importedUser.mustChangePassword).toBe(true);
    expect(String(importedUser.departmentId)).toBe(String(deptA1._id));
  });

  it('isolates audit logs per scope and switches dashboard home via X-Role-Context (US1-9)', async () => {
    // University-level action (college create)
    await request(app)
      .post('/api/v1/colleges')
      .set('Authorization', `Bearer ${uniAdminToken}`)
      .send({ name: 'كلية الطب', code: 'MED' });

    // College A action
    await request(app)
      .post(`/api/v1/colleges/${collegeA._id}/departments`)
      .set('Authorization', `Bearer ${collegeAdminAToken}`)
      .send({ name: 'هندسة القوى', code: 'EE' });

    // College A admin must NOT see university-level college creation audit log
    const collegeAAudits = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${collegeAdminAToken}`);
    expect(collegeAAudits.status).toBe(200);
    expect(collegeAAudits.body.data.every((entry) => String(entry.scope?.collegeId) === String(collegeA._id))).toBe(true);
    expect(collegeAAudits.body.data.some((entry) => entry.action === 'college.create')).toBe(false);

    const allAudits = await AuditLog.find({}).lean();
    expect(allAudits.some((a) => a.action === 'college.create')).toBe(true);

    // Multi-role dashboard home with X-Role-Context
    const supDash = await request(app)
      .get('/api/v1/dashboard/home')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .set('X-Role-Context', multiRoleSupervisorId);
    expect(supDash.status).toBe(200);
    expect(supDash.body.data.activeRole).toBe(ROLES.SUPERVISOR);

    const deptDash = await request(app)
      .get('/api/v1/dashboard/home')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .set('X-Role-Context', multiRoleDeptAdminId);
    expect(deptDash.status).toBe(200);
    expect(deptDash.body.data.activeRole).toBe(ROLES.DEPARTMENT_ADMIN);

    // Invalid X-Role-Context returns 403 FORBIDDEN
    const badContext = await request(app)
      .get('/api/v1/dashboard/home')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .set('X-Role-Context', '65f000000000000000000999');
    expect(badContext.status).toBe(403);
  });
});
