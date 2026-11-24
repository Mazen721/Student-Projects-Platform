import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import ar from '@/locales/ar';
import { useAuthStore } from '@/stores/authStore';
import { CardSkeleton, EmptyState } from '@/components/ui';

export function RequireAuth({ allowTempPassword = false }) {
  const location = useLocation();
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!initialized) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <CardSkeleton />
      </div>
    );
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.mustChangePassword && !allowTempPassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function RoleDeniedNotice() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl py-8">
      <EmptyState
        icon={ShieldAlert}
        title={ar.common.accessDeniedTitle}
        description={ar.common.accessDeniedBody}
        actionLabel={ar.nav.home}
        onAction={() => navigate('/app')}
      />
    </div>
  );
}

export function RequireRole({ allowedRoles = [] }) {
  const roles = useAuthStore((s) => s.roles);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  // Gate on the ACTIVE role context — the same context the API authorizes
  // against. Checking every assignment instead let multi-post users open
  // pages whose data is scoped to another post, which rendered as empty
  // screens; their other posts' pages unlock when they switch context.
  const activeAssignment =
    roles.find((r) => String(r._id) === String(activeRoleId)) || roles[0] || null;
  const hasRole =
    allowedRoles.length === 0 ||
    Boolean(activeAssignment && allowedRoles.includes(activeAssignment.role));

  if (!hasRole) {
    // Explain instead of silently bouncing home: users used to land on the
    // dashboard with no idea why the page they opened "did not work".
    return <RoleDeniedNotice />;
  }

  return <Outlet />;
}
