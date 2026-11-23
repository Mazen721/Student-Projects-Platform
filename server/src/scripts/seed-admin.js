import pino from 'pino';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../core/auth/tokens.js';
import User from '../modules/auth/user.model.js';
import University from '../modules/organization/university.model.js';

const logger = pino({ level: 'info' });

async function run() {
  await connectDb();

  let university = await University.findOne();
  if (!university) {
    university = await University.create({
      name: 'جامعة المنصورة الأهلية',
      settings: { allowedEmailDomains: ['mnu.edu.eg'] },
    });
    logger.info({ id: university._id }, 'Created University singleton');
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@mnu.edu.eg').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
  const existing = await User.findOne({ email: adminEmail, emailReleased: false });

  if (!existing) {
    const passwordHash = await hashPassword(adminPassword);
    const admin = await User.create({
      name: 'مدير النظام الجامعي',
      email: adminEmail,
      passwordHash,
      mustChangePassword: env.NODE_ENV === 'production',
      status: USER_STATUSES.ACTIVE,
      accountType: 'staff',
      roles: [{ role: ROLES.UNIVERSITY_ADMIN, scopeType: SCOPE_TYPES.UNIVERSITY }],
    });
    logger.info({ email: admin.email }, 'Created initial University Admin');
  } else {
    logger.info({ email: existing.email }, 'Initial University Admin already exists');
  }

  await disconnectDb();
}

run().catch(async (err) => {
  logger.error({ err }, 'seed-admin failed');
  await disconnectDb();
  process.exit(1);
});
