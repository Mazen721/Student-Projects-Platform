import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Home,
  Lightbulb,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Avatar, Drawer, ToastContainer } from '@/components/ui';

function getRoleNavItems(roles = []) {
  const roleNames = new Set(roles.map((r) => r.role));
  const items = [
    { to: '/app', label: ar.nav.home, icon: Home, end: true },
    { to: '/app/projects', label: ar.nav.projects, icon: FolderKanban },
    { to: '/app/chat', label: ar.nav.chat, icon: MessageSquare },
  ];

  if (
    roleNames.has(ROLES.UNIVERSITY_ADMIN) ||
    roleNames.has(ROLES.COLLEGE_ADMIN) ||
    roleNames.has(ROLES.DEPARTMENT_ADMIN) ||
    roleNames.has(ROLES.SUPERVISOR)
  ) {
    items.push({ to: '/app/reports', label: ar.nav.reports, icon: BarChart3 });
  } else {
    items.push({ to: '/', label: ar.nav.showcase, icon: Sparkles });
  }

  const secondary = [
    { to: '/app/announcements', label: ar.chat.announcements, icon: Megaphone },
    { to: '/app/ideas', label: ar.nav.ideas, icon: Lightbulb },
    { to: '/app/challenges', label: ar.showcase.challenges, icon: Briefcase },
    { to: '/competitions', label: ar.nav.competitions, icon: Trophy },
    { to: '/app/profile', label: ar.nav.profile, icon: User },
  ];

  if (roleNames.has(ROLES.INVESTOR)) {
    secondary.unshift({
      to: '/app/investor',
      label: ar.showcase.investorWorkspaceTitle,
      icon: Briefcase,
    });
  }

  if (roleNames.has(ROLES.SUPERVISOR)) {
    secondary.push({
      to: '/app/reports/supervisor',
      label: ar.reports.supervisorDashboard,
      icon: BarChart3,
    });
  }

  if (
    roleNames.has(ROLES.UNIVERSITY_ADMIN) ||
    roleNames.has(ROLES.COLLEGE_ADMIN) ||
    roleNames.has(ROLES.DEPARTMENT_ADMIN) ||
    roleNames.has(ROLES.SUPERVISOR)
  ) {
    secondary.push({ to: '/app/projects/reviews', label: ar.projects.reviewQueue, icon: ClipboardList });
  }

  if (
    roleNames.has(ROLES.UNIVERSITY_ADMIN) ||
    roleNames.has(ROLES.COLLEGE_ADMIN) ||
    roleNames.has(ROLES.DEPARTMENT_ADMIN) ||
    roleNames.has(ROLES.SUPERVISOR) ||
    roleNames.has(ROLES.COMMITTEE_MEMBER)
  ) {
    secondary.push({ to: '/app/defenses', label: ar.evaluation.defenseCalendar, icon: ClipboardList });
  }

  if (
    roleNames.has(ROLES.UNIVERSITY_ADMIN) ||
    roleNames.has(ROLES.COLLEGE_ADMIN) ||
    roleNames.has(ROLES.DEPARTMENT_ADMIN)
  ) {
    secondary.push({ to: '/app/supervisors/load', label: ar.projects.supervisorLoad, icon: Users });
    secondary.push({ to: '/app/organization', label: ar.nav.organization, icon: Building2 });
    secondary.push({ to: '/app/users', label: ar.nav.users, icon: Users });
    secondary.push({ to: '/app/audit-logs', label: ar.org.auditLogs, icon: ClipboardList });
  }

  if (roleNames.has(ROLES.UNIVERSITY_ADMIN) || roleNames.has(ROLES.COLLEGE_ADMIN)) {
    secondary.push({ to: '/app/reevaluations', label: ar.evaluation.reevaluationQueue, icon: ClipboardList });
    secondary.push({ to: '/app/votes/flagged', label: ar.showcase.flaggedVotesTitle, icon: ShieldAlert });
    secondary.push({ to: '/app/imports', label: ar.org.bulkImport, icon: FileSpreadsheet });
  }

  return { primary: items.slice(0, 4), secondary };
}

export function AppLayout({ unreadCount: unreadCountProp, roleSwitcherSlot = null }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const roles = useAuthStore((s) => s.roles);
  const clearSession = useAuthStore((s) => s.clearSession);
  const moreDrawerOpen = useUiStore((s) => s.moreDrawerOpen);
  const setMoreDrawerOpen = useUiStore((s) => s.setMoreDrawerOpen);
  const socketReconnecting = useUiStore((s) => s.socketReconnecting);
  const [liveUnread, setLiveUnread] = useState(0);
  const unreadCount = unreadCountProp ?? liveUnread;

  useEffect(() => {
    if (!accessToken || unreadCountProp !== undefined) return undefined;
    let active = true;
    api
      .get('/notifications', { params: { limit: 1 } })
      .then((res) => {
        if (active && typeof res.data?.unreadCount === 'number') {
          setLiveUnread(res.data.unreadCount);
        }
      })
      .catch(() => {});

    const socket = getSocket() || connectSocket();
    if (!socket) {
      return () => {
        active = false;
      };
    }
    const onCount = (payload) => {
      if (typeof payload?.unread === 'number') {
        setLiveUnread(payload.unread);
      }
    };
    socket.on('notification:count', onCount);
    return () => {
      active = false;
      socket.off('notification:count', onCount);
    };
  }, [accessToken, unreadCountProp]);

  const { primary, secondary } = getRoleNavItems(roles);
  const allNavItems = [...primary, ...secondary];

  async function handleLogout() {
    try {
      await api.post('/auth/logout', {}, { headers: { 'X-Requested-With': 'spp' } });
    } catch {
      // Proceed with local cleanup even if cookie was already cleared.
    } finally {
      disconnectSocket();
      clearSession();
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app-bg text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-xl focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-navy"
      >
        {ar.common.skipToContent}
      </a>

      <header className="sticky top-0 z-30 bg-navy text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-3 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1">
              <img
                src="/logo-placeholder.svg"
                alt={ar.common.universityName}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="truncate text-sm font-extrabold sm:text-base">
              {ar.common.platformName}
            </span>
          </div>

          <nav aria-label={ar.nav.home} className="hidden items-center gap-1 lg:flex">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      isActive ? 'bg-gold text-navy' : 'text-white/90 hover:bg-navy-light'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <NavLink
              to="/app/notifications"
              aria-label={ar.nav.notifications}
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white hover:bg-navy-light"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 end-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-extrabold text-navy">
                  {unreadCount}
                </span>
              )}
            </NavLink>

            <div className="hidden items-center gap-2 lg:flex">
              <Avatar src={user?.profile?.avatar?.url} name={user?.name} size="sm" />
              <span className="max-w-[9rem] truncate text-xs font-bold text-white/90">
                {user?.name}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label={ar.nav.logout}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/90 hover:bg-navy-light cursor-pointer"
            >
              <LogOut className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {socketReconnecting && (
        <div
          role="status"
          className="bg-[#fef3c7] px-4 py-1.5 text-center text-xs font-bold text-[#b45309]"
        >
          {ar.common.reconnectingSocket}
        </div>
      )}

      <main
        id="main-content"
        className="mx-auto w-full max-w-[80rem] flex-1 px-4 py-5 pb-24 lg:px-8 lg:py-6 lg:pb-8"
      >
        <Outlet />
      </main>

      <footer className="hidden bg-navy-dark py-5 text-white/80 lg:block">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between px-8 text-xs">
          <span className="font-bold text-white">{ar.common.platformName}</span>
          <span>{ar.common.universityName}</span>
        </div>
      </footer>

      <nav
        aria-label={ar.nav.home}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {primary.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.7rem] font-bold ${
                  isActive ? 'text-navy' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-3 py-0.5 ${
                      isActive ? 'bg-gold text-navy' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="truncate max-w-full">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreDrawerOpen(true)}
          aria-label={ar.common.more}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.7rem] font-bold text-muted cursor-pointer"
        >
          <span className="inline-flex items-center justify-center rounded-full px-3 py-0.5">
            <Menu className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{ar.common.more}</span>
        </button>
      </nav>

      <Drawer
        open={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        title={ar.common.more}
      >
        <div className="space-y-4">
          {roleSwitcherSlot}
          <div className="flex flex-col gap-1">
            {secondary.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold ${
                      isActive ? 'bg-gold text-navy' : 'text-ink hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </Drawer>

      <ToastContainer />
    </div>
  );
}
