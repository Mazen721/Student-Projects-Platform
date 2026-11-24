import { Navigate } from 'react-router-dom';
import { ROLES } from '@spp/shared/constants';
import { useAuthStore } from '@/stores/authStore';
import AnalyticsDashboardPage from './AnalyticsDashboardPage';

const ADMIN_ROLE_NAMES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

// The reports landing page: the analytics dashboard only works under an
// admin scope — under a supervisor role context its API returns 404 and the
// page rendered as an empty "no data" screen. Supervisors land on their own
// dashboard instead, which is the reports home designed for them.
export default function ReportsHomePage() {
  const roles = useAuthStore((s) => s.roles);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  const activeAssignment =
    roles.find((r) => String(r._id) === String(activeRoleId)) || roles[0] || null;

  const hasAdmin = roles.some((r) => ADMIN_ROLE_NAMES.has(r.role));
  const hasSupervisor = roles.some((r) => r.role === ROLES.SUPERVISOR);

  if (activeAssignment?.role === ROLES.SUPERVISOR && hasSupervisor) {
    return <Navigate to="/app/reports/supervisor" replace />;
  }
  if (!hasAdmin && hasSupervisor) {
    return <Navigate to="/app/reports/supervisor" replace />;
  }
  return <AnalyticsDashboardPage />;
}
