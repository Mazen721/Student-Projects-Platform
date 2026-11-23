import pino from 'pino';
import { connectDb, disconnectDb } from '../config/db.js';
import College from '../modules/organization/college.model.js';
import { seedCollabAndEval } from './seed/collabAndEval.js';
import { wipeCollectionsForReset } from './seed/helpers.js';
import { DEMO_PASSWORD, seedOrgAndUsers } from './seed/orgAndUsers.js';
import { seedProjectsAndTracking } from './seed/projectsAndTracking.js';
import { seedShowcaseAndAudit } from './seed/showcaseAndAudit.js';

const logger = pino({ level: 'info' });
const shouldReset = process.argv.includes('--reset');

async function run() {
  await connectDb();

  const existingColleges = await College.countDocuments();
  if (existingColleges > 0 && !shouldReset) {
    logger.info(
      { existingColleges },
      'Database already contains seeded data. Re-run with --reset to wipe and re-seed cleanly.'
    );
    await disconnectDb();
    return;
  }

  if (shouldReset) {
    logger.info('Reset flag detected — wiping existing collections before seeding...');
    await wipeCollectionsForReset();
  }

  logger.info('1/4 Seeding Mansoura National University org structure, years, templates, rubrics, and users...');
  const orgCtx = await seedOrgAndUsers();

  logger.info('2/4 Seeding Idea Bank, 16 projects across all statuses/years, tracking phases, deliverables, tasks, BOM, and tools...');
  const projCtx = await seedProjectsAndTracking(orgCtx);

  logger.info('3/4 Seeding announcements, chat channels/messages, media galleries, defenses, committees, scores, grades, and re-evaluations...');
  const collabEvalCtx = await seedCollabAndEval({ ...orgCtx, ...projCtx });

  logger.info('4/4 Seeding showcase mini-sites, competitions, votes, page views, investor workspace, notifications, audit logs, and analytics cache...');
  const { trendingResult, statsResult } = await seedShowcaseAndAudit({
    ...orgCtx,
    ...projCtx,
    ...collabEvalCtx,
  });

  logger.info(
    {
      colleges: Object.keys(orgCtx.colleges).length,
      departments: Object.keys(orgCtx.departments).length,
      users: Object.keys(orgCtx.users).length,
      projects: Object.keys(projCtx.projects).length,
      ideas: Object.keys(projCtx.ideas).length,
      defenses: Object.keys(collabEvalCtx.defenses).length,
      trending: trendingResult,
      statsCache: statsResult,
      demoPassword: DEMO_PASSWORD,
    },
    'Mansoura National University full demo seed complete!'
  );

  await disconnectDb();
}

run().catch(async (err) => {
  logger.error({ err }, 'seed-demo failed');
  await disconnectDb();
  process.exit(1);
});
