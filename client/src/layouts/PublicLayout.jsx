import { Link, NavLink, Outlet } from 'react-router-dom';
import ar from '@/locales/ar';
import { useAuthStore } from '@/stores/authStore';
import { ToastContainer } from '@/components/ui';

export function PublicLayout() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isSignedIn = Boolean(user && accessToken);
  return (
    <div className="flex min-h-dvh flex-col bg-app-bg text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-xl focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-navy"
      >
        {ar.common.skipToContent}
      </a>

      <header className="bg-navy text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-3 px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1">
              <img
                src="/mnu-logo.png"
                alt={ar.common.universityName}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="truncate text-sm font-extrabold sm:text-base">
              {ar.common.platformName}
            </span>
          </Link>

          <nav aria-label={ar.nav.showcase} className="flex items-center gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hidden min-h-11 items-center rounded-xl px-3 py-2 text-sm font-bold sm:inline-flex ${
                  isActive ? 'bg-navy-light text-gold-light' : 'text-white/90 hover:bg-navy-light'
                }`
              }
            >
              {ar.nav.showcase}
            </NavLink>
            <NavLink
              to="/competitions"
              className={({ isActive }) =>
                `hidden min-h-11 items-center rounded-xl px-3 py-2 text-sm font-bold sm:inline-flex ${
                  isActive ? 'bg-navy-light text-gold-light' : 'text-white/90 hover:bg-navy-light'
                }`
              }
            >
              {ar.nav.competitions}
            </NavLink>
            {isSignedIn ? (
              <Link
                to="/app"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-extrabold text-navy transition hover:bg-gold-light"
              >
                {ar.nav.goToApp}
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-extrabold text-navy transition hover:bg-gold-light"
              >
                {ar.nav.login}
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[80rem] flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="bg-navy-dark py-6 text-white/80">
        <div className="mx-auto flex max-w-[80rem] flex-col items-center justify-between gap-2 px-4 text-xs sm:flex-row lg:px-8">
          <span className="font-bold text-white">{ar.common.platformName}</span>
          <span>{ar.common.universityName}</span>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
}
