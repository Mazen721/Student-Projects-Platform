import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { CardSkeleton } from '@/components/ui';

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

export function RequireRole({ allowedRoles = [] }) {
  const roles = useAuthStore((s) => s.roles);
  const hasRole =
    allowedRoles.length === 0 ||
    roles.some((assignment) => allowedRoles.includes(assignment.role));

  if (!hasRole) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
