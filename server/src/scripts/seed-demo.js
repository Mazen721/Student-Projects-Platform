import pino from 'pino';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { connectDb, disconnectDb } from '../config/db.js';
import { hashPassword } from '../core/auth/tokens.js';
import User from '../modules/auth/user.model.js';
import AcademicYear from '../modules/organization/academicYear.model.js';
import College from '../modules/organization/college.model.js';
import Department from '../modules/organization/department.model.js';
import University from '../modules/organization/university.model.js';

const logger = pino({ level: 'info' });

async function ensureCollege(name, code) {
  return College.findOneAndUpdate(
    { code },
    { $setOnInsert: { name, code } },
    { upsert: true, new: true }
  );
}

async function ensureDepartment(name, code, collegeId) {
  return Department.findOneAndUpdate(
    { collegeId, code },
    { $setOnInsert: { name, code, collegeId } },
    { upsert: true, new: true }
  );
}

async function ensureUser(payload) {
  const existing = await User.findOne({ email: payload.email, emailReleased: false });
  if (existing) return existing;
  return User.create(payload);
}

async function run() {
  await connectDb();

  await University.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        name: 'جامعة المنصورة الأهلية',
        settings: { allowedEmailDomains: ['mnu.edu.eg'] },
      },
    },
    { upsert: true, new: true }
  );

  const eng = await ensureCollege('كلية الهندسة', 'ENG');
  const cs = await ensureCollege('كلية علوم وهندسة الحاسبات', 'CSE');

  const ce = await ensureDepartment('هندسة الحاسبات والنظم', 'CE', eng._id);
  const ee = await ensureDepartment('هندسة القوى والآلات', 'EE', eng._id);
  const ai = await ensureDepartment('الذكاء الاصطناعي', 'AI', cs._id);

  for (const college of [eng, cs]) {
    const existingAy = await AcademicYear.findOne({ collegeId: college._id, isCurrent: true });
    if (!existingAy) {
      await AcademicYear.create({
        collegeId: college._id,
        label: '2026/2027',
        isCurrent: true,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        semesters: [
          { name: 'الفصل الأول', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-20') },
          { name: 'الفصل الثاني', startDate: new Date('2027-02-01'), endDate: new Date('2027-06-30') },
        ],
        cycle: {
          registrationOpensAt: new Date('2026-09-01'),
          registrationClosesAt: new Date('2027-01-15'),
          proposalDeadline: new Date('2027-02-01'),
          defenseStart: new Date('2027-05-15'),
          defenseEnd: new Date('2027-06-20'),
        },
      });
    }
  }

  const passwordHash = await hashPassword('Demo1234!');

  await ensureUser({
    name: 'مدير الجامعة',
    email: 'admin@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: 'staff',
    roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
  });

  await ensureUser({
    name: 'د. محمد العميد',
    email: 'eng.admin@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: 'staff',
    collegeId: eng._id,
    roles: [{ role: ROLES.COLLEGE_ADMIN, scopeType: SCOPE_TYPES.COLLEGE, scopeId: eng._id, collegeId: eng._id }],
  });

  await ensureUser({
    name: 'د. طارق المشرف',
    email: 'supervisor@mnu.edu.eg',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: 'staff',
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

  await ensureUser({
    name: 'سارة علي',
    email: 'sara@mnu.edu.eg',
    studentId: '20260001',
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: 'student',
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

  await ensureUser({
    name: 'شركة المستقبل للاستثمار',
    email: 'investor@future.com',
    passwordHash,
    status: USER_STATUSES.PENDING,
    accountType: 'investor',
    investor: { organization: 'المستقبل للتقنية', fieldOfInterest: 'الأنظمة الذكية' },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  });

  logger.info({ ee: ee.code, ai: ai.code }, 'Demo multi-college seed complete');
  await disconnectDb();
}

run().catch(async (err) => {
  logger.error({ err }, 'seed-demo failed');
  await disconnectDb();
  process.exit(1);
});
