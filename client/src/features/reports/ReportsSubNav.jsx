import { NavLink } from 'react-router-dom';
import { ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { useAuthStore } from '@/stores/authStore';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

export function ReportsSubNav() {
  const roles = useAuthStore((s) => s.roles);
  const hasAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));
  const hasSupervisor = roles.some((r) => r.role === ROLES.SUPERVISOR);

  const tabs = [{ to: '/app/reports', label: ar.reports.dashboard, end: true }];

  if (hasAdmin) {
    tabs.push(
      { to: '/app/reports/projects', label: ar.reports.projects },
      { to: '/app/reports/completion', label: ar.reports.completion },
      { to: '/app/reports/supervisors', label: ar.reports.supervisors },
      { to: '/app/reports/evaluation', label: ar.reports.evaluation },
      { to: '/app/reports/insights', label: ar.reports.insights }
    );
  }

  if (hasSupervisor) {
    tabs.push({ to: '/app/reports/supervisor', label: ar.reports.supervisorDashboard });
  }

  return (
    <nav
      aria-label={ar.nav.reports}
      className="flex gap-2 overflow-x-auto border-b border-line pb-2"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold transition ${
              isActive
                ? 'bg-gold text-navy'
                : 'bg-white text-muted border border-line hover:text-navy'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
