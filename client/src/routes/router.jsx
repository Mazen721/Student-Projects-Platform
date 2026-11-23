import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Link, Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { refreshAccessToken, setSessionExpiredHandler } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { CardSkeleton } from '@/components/ui';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { RequireAuth, RequireRole } from '@/routes/guards';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const AcceptInvitePage = lazy(() => import('@/features/auth/AcceptInvitePage'));
const ChangePasswordPage = lazy(() => import('@/features/auth/ChangePasswordPage'));
const ProfilePage = lazy(() => import('@/features/auth/ProfilePage'));
const HomeDashboardPage = lazy(() => import('@/features/organization/HomeDashboardPage'));
const CollegesPage = lazy(() => import('@/features/organization/CollegesPage'));
const DepartmentsPage = lazy(() => import('@/features/organization/DepartmentsPage'));
const AcademicYearsPage = lazy(() => import('@/features/organization/AcademicYearsPage'));
const UsersAdminPage = lazy(() => import('@/features/organization/UsersAdminPage'));
const BulkImportPage = lazy(() => import('@/features/organization/BulkImportPage'));
const AuditLogsPage = lazy(() => import('@/features/organization/AuditLogsPage'));
const ProjectsListPage = lazy(() => import('@/features/projects/ProjectsListPage'));
const ProposalFormPage = lazy(() => import('@/features/projects/ProposalFormPage'));
const ProjectOverviewPage = lazy(() => import('@/features/projects/ProjectOverviewPage'));
const ProposalReviewPage = lazy(() => import('@/features/projects/ProposalReviewPage'));
const SupervisorLoadPage = lazy(() => import('@/features/projects/SupervisorLoadPage'));
const IdeasBankPage = lazy(() => import('@/features/projects/IdeasBankPage'));
const PhaseTemplatesPage = lazy(() => import('@/features/tracking/PhaseTemplatesPage'));

function LazyRoute({ children }) {
  return <Suspense fallback={<CardSkeleton />}>{children}</Suspense>;
}

function SessionBootstrap() {
  const initialized = useAuthStore((s) => s.initialized);
  const markInitialized = useAuthStore((s) => s.markInitialized);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      addToast({ message: ar.common.sessionExpired, tone: 'warning' });
    });
    if (!initialized) {
      refreshAccessToken().catch(() => {
        markInitialized();
      });
    }
  }, [initialized, markInitialized, addToast]);

  return (
    <>
      <Helmet>
        <title>{ar.common.platformName}</title>
      </Helmet>
      <Outlet />
    </>
  );
}

function HomePlaceholderPage() {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <header className="mb-4 rounded-xl bg-navy p-6 text-white">
        <h1 className="text-2xl font-extrabold">{ar.showcase.homeTitle}</h1>
        <p className="mt-2 text-sm text-gold-light">{ar.showcase.homeSubtitle}</p>
      </header>
      <p className="text-muted">{ar.common.universityName}</p>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-extrabold text-navy">{ar.common.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{ar.common.notFoundDescription}</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-5 py-2.5 font-extrabold text-navy transition hover:bg-gold-light"
      >
        {ar.common.backHome}
      </Link>
    </section>
  );
}

const ADMIN_ROLES = [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN];
const COLLEGE_OR_UNI_ADMIN = [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN];
const REVIEW_ROLES = [ROLES.SUPERVISOR, ...ADMIN_ROLES];
const IDEAS_ROLES = [ROLES.STUDENT, ROLES.SUPERVISOR, ROLES.INVESTOR, ...ADMIN_ROLES];

export const router = createBrowserRouter([
  {
    element: <SessionBootstrap />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <HomePlaceholderPage /> },
          { path: '/competitions', element: <HomePlaceholderPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LazyRoute><LoginPage /></LazyRoute> },
          { path: '/register', element: <LazyRoute><RegisterPage /></LazyRoute> },
          { path: '/accept-invite/:token', element: <LazyRoute><AcceptInvitePage /></LazyRoute> },
          {
            element: <RequireAuth allowTempPassword />,
            children: [
              { path: '/change-password', element: <LazyRoute><ChangePasswordPage /></LazyRoute> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/app',
            element: <AppLayout roleSwitcherSlot={<RoleSwitcher />} />,
            children: [
              { index: true, element: <LazyRoute><HomeDashboardPage /></LazyRoute> },
              { path: 'profile', element: <LazyRoute><ProfilePage /></LazyRoute> },
              { path: 'projects', element: <LazyRoute><ProjectsListPage /></LazyRoute> },
              { path: 'projects/:id', element: <LazyRoute><ProjectOverviewPage /></LazyRoute> },
              {
                element: <RequireRole allowedRoles={[ROLES.STUDENT]} />,
                children: [
                  { path: 'projects/new', element: <LazyRoute><ProposalFormPage /></LazyRoute> },
                  { path: 'projects/:id/edit', element: <LazyRoute><ProposalFormPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={REVIEW_ROLES} />,
                children: [
                  { path: 'projects/reviews', element: <LazyRoute><ProposalReviewPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={IDEAS_ROLES} />,
                children: [
                  { path: 'ideas', element: <LazyRoute><IdeasBankPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={ADMIN_ROLES} />,
                children: [
                  { path: 'supervisors/load', element: <LazyRoute><SupervisorLoadPage /></LazyRoute> },
                  { path: 'organization', element: <LazyRoute><CollegesPage /></LazyRoute> },
                  {
                    path: 'organization/colleges/:collegeId/departments',
                    element: <LazyRoute><DepartmentsPage /></LazyRoute>,
                  },
                  {
                    path: 'organization/colleges/:collegeId/academic-years',
                    element: <LazyRoute><AcademicYearsPage /></LazyRoute>,
                  },
                  {
                    path: 'organization/colleges/:collegeId/phase-templates',
                    element: <LazyRoute><PhaseTemplatesPage /></LazyRoute>,
                  },
                  { path: 'users', element: <LazyRoute><UsersAdminPage /></LazyRoute> },
                  { path: 'audit-logs', element: <LazyRoute><AuditLogsPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={COLLEGE_OR_UNI_ADMIN} />,
                children: [
                  { path: 'imports', element: <LazyRoute><BulkImportPage /></LazyRoute> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
