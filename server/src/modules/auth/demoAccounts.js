import ar from '@spp/shared/locales/ar';

/**
 * Demo quick-login accounts for showcasing the platform.
 *
 * Each key maps to a user created by the demo seed
 * (`server/src/scripts/seed-demo.js`, Mansoura National University dataset):
 * the two students are teammates on the same project (Retina AI), so the
 * live team chat can be demonstrated by signing in as both of them.
 *
 * The feature is OFF unless ENABLE_DEMO_LOGIN=true is set in the server
 * environment (checked at request time, mirroring the Volunteering system).
 * While it is on, anyone who can reach the login page can enter as these
 * accounts — turn it off again after a showcase.
 */
export const DEMO_ACCOUNTS = Object.freeze([
  { key: 'university_admin', email: 'admin@mnu.edu.eg', title: ar.auth.demoUniversityAdmin },
  { key: 'college_admin', email: 'eng.admin@mnu.edu.eg', title: ar.auth.demoCollegeAdmin },
  { key: 'supervisor', email: 'supervisor@mnu.edu.eg', title: ar.auth.demoSupervisor },
  { key: 'student_one', email: 'sara@mnu.edu.eg', title: ar.auth.demoStudentOne },
  { key: 'student_two', email: 'youssef.ahmed@mnu.edu.eg', title: ar.auth.demoStudentTwo },
  { key: 'visitor', email: 'nada.visitor@gmail.com', title: ar.auth.demoVisitor },
]);

export const DEMO_ACCOUNT_KEYS = Object.freeze(DEMO_ACCOUNTS.map((a) => a.key));

export function isDemoLoginEnabled() {
  return process.env.ENABLE_DEMO_LOGIN === 'true';
}

export function findDemoAccount(key) {
  return DEMO_ACCOUNTS.find((a) => a.key === key) || null;
}

export function listDemoAccounts() {
  return DEMO_ACCOUNTS.map(({ key, title }) => ({ key, title }));
}
