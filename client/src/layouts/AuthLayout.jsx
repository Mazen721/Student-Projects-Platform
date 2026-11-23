import { Link, Outlet } from 'react-router-dom';
import ar from '@/locales/ar';
import { ToastContainer } from '@/components/ui';

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-app-bg px-4 py-8 text-ink">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <Link
          to="/"
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-white p-2 shadow-sm"
        >
          <img
            src="/logo-placeholder.svg"
            alt={ar.common.universityName}
            className="h-full w-full object-contain"
          />
        </Link>
        <h1 className="text-lg font-extrabold text-navy">{ar.common.platformName}</h1>
        <p className="text-xs font-semibold text-muted">{ar.common.universityName}</p>
      </div>

      <main className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-[0_1px_3px_rgba(18,47,74,0.05)]">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
