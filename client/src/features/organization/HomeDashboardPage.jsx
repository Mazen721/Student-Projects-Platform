import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Building2, Calendar, FileSpreadsheet, FolderKanban, Sparkles, Users } from 'lucide-react';
import { ROLES, USER_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { formatDate, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Card, CardSkeleton } from '@/components/ui';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { useDashboardHomeQuery } from './orgApi';

function StatTile({ label, value, icon: Icon }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black text-navy">{formatNumber(value)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf3d7] text-[#7c5e0b]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

export default function HomeDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  const { data, isLoading } = useDashboardHomeQuery(activeRoleId);

  if (isLoading || !data) {
    return <CardSkeleton />;
  }

  const { activeRole, userStatus, summary } = data;
  const isPendingInvestor = userStatus === USER_STATUSES.PENDING;

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.nav.home} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{t('dashboard.welcome', { name: user?.name || '' })}</h1>
            {activeRole && (
              <div className="mt-2">
                <Badge tone="featured">{t(`roles.${activeRole}`)}</Badge>
              </div>
            )}
          </div>
          <div className="w-full sm:w-56">
            <RoleSwitcher compact />
          </div>
        </div>
      </section>

      {isPendingInvestor && (
        <Card>
          <div className="space-y-3">
            <Badge tone="warning">{ar.statuses.pending}</Badge>
            <h2 className="text-lg font-extrabold text-navy">{ar.auth.pendingInvestorNotice}</h2>
            <p className="text-sm text-muted">{ar.auth.pendingInvestorHint}</p>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-extrabold text-navy hover:bg-gold-light"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{ar.dashboard.goToShowcase}</span>
            </Link>
          </div>
        </Card>
      )}

      {!isPendingInvestor && activeRole === ROLES.STUDENT && (
        <Card title={ar.dashboard.studentWorkTitle}>
          <div className="space-y-4">
            {summary?.currentAcademicYear ? (
              <div className="rounded-xl border border-line bg-app-bg p-4 text-sm">
                <p className="font-extrabold text-navy">
                  {ar.dashboard.activeCycleTitle}{' '}
                  <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                    ({summary.currentAcademicYear.label})
                  </span>
                </p>
                <div className="mt-2 grid gap-2 text-muted sm:grid-cols-2">
                  <p>
                    {ar.dashboard.registrationWindow}:{' '}
                    <strong className="text-ink">
                      {formatDate(summary.currentAcademicYear.cycle?.registrationClosesAt)}
                    </strong>
                  </p>
                  <p>
                    {ar.dashboard.proposalDeadline}:{' '}
                    <strong className="text-ink">
                      {formatDate(summary.currentAcademicYear.cycle?.proposalDeadline)}
                    </strong>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">{ar.dashboard.noActiveCycle}</p>
            )}

            <Link
              to="/app/projects"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-extrabold text-navy hover:bg-gold-light"
            >
              <FolderKanban className="h-4 w-4" aria-hidden="true" />
              <span>{ar.dashboard.goToProjects}</span>
            </Link>
          </div>
        </Card>
      )}

      {!isPendingInvestor &&
        [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.SUPERVISOR].includes(
          activeRole
        ) && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label={ar.dashboard.statColleges} value={summary?.collegesCount || 0} icon={Building2} />
              <StatTile label={ar.dashboard.statDepartments} value={summary?.departmentsCount || 0} icon={Calendar} />
              <StatTile label={ar.dashboard.statUsers} value={summary?.totalUsers || 0} icon={Users} />
              {activeRole === ROLES.UNIVERSITY_ADMIN && (
                <StatTile
                  label={ar.dashboard.statPendingInvestors}
                  value={summary?.pendingInvestors || 0}
                  icon={Users}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {[ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(activeRole) && (
                <>
                  <Link
                    to="/app/organization"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light"
                  >
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.dashboard.goToOrganization}</span>
                  </Link>
                  <Link
                    to="/app/users"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-navy hover:bg-slate-50"
                  >
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.dashboard.goToUsers}</span>
                  </Link>
                </>
              )}
              {[ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN].includes(activeRole) && (
                <Link
                  to="/app/imports"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-navy hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.dashboard.goToBulkImport}</span>
                </Link>
              )}
            </div>
          </>
        )}

      {!isPendingInvestor && [ROLES.INVESTOR, ROLES.VISITOR].includes(activeRole) && (
        <Card>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-extrabold text-navy hover:bg-gold-light"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{ar.dashboard.goToShowcase}</span>
          </Link>
        </Card>
      )}
    </div>
  );
}
