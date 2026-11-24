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
const ProjectChatPage = lazy(() => import('@/features/collaboration/ProjectChatPage'));
const NotificationCenter = lazy(() => import('@/features/collaboration/NotificationCenter'));
const AnnouncementsPage = lazy(() => import('@/features/collaboration/AnnouncementsPage'));
const RubricsPage = lazy(() => import('@/features/evaluation/RubricsPage'));
const DefenseSchedulingPage = lazy(() => import('@/features/evaluation/DefenseSchedulingPage'));
const GradingWorkspacePage = lazy(() => import('@/features/evaluation/GradingWorkspacePage'));
const ReEvaluationQueuePage = lazy(() => import('@/features/evaluation/ReEvaluationQueuePage'));
const PublicHomePage = lazy(() => import('@/features/showcase/PublicHomePage'));
const CollegeShowcasePage = lazy(() => import('@/features/showcase/CollegeShowcasePage'));
const ProjectMiniSitePage = lazy(() => import('@/features/showcase/ProjectMiniSitePage'));
const CompetitionsPage = lazy(() => import('@/features/showcase/CompetitionsPage'));
const FlaggedVotesPage = lazy(() => import('@/features/showcase/FlaggedVotesPage'));
const InvestorWorkspacePage = lazy(() => import('@/features/showcase/InvestorWorkspacePage'));
const ReportsHomePage = lazy(() => import('@/features/reports/ReportsHomePage'));
const SupervisorDashboardPage = lazy(() => import('@/features/reports/SupervisorDashboardPage'));
const ProjectReportsPage = lazy(() => import('@/features/reports/ProjectReportsPage'));
const CompletionReportPage = lazy(() => import('@/features/reports/CompletionReportPage'));
const SupervisorDistributionPage = lazy(() => import('@/features/reports/SupervisorDistributionPage'));
const EvaluationReportPage = lazy(() => import('@/features/reports/EvaluationReportPage'));
const InsightsReportPage = lazy(() => import('@/features/reports/InsightsReportPage'));

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
const DEFENSE_ROLES = [ROLES.SUPERVISOR, ROLES.COMMITTEE_MEMBER, ...ADMIN_ROLES];
const IDEAS_ROLES = [ROLES.STUDENT, ROLES.SUPERVISOR, ROLES.INVESTOR, ...ADMIN_ROLES];
const WORKSPACE_ROLES = [ROLES.STUDENT, ROLES.SUPERVISOR, ...ADMIN_ROLES];

export const router = createBrowserRouter([
  {
    element: <SessionBootstrap />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <LazyRoute><PublicHomePage /></LazyRoute> },
          { path: '/colleges/:id/showcase', element: <LazyRoute><CollegeShowcasePage /></LazyRoute> },
          { path: '/p/:slug', element: <LazyRoute><ProjectMiniSitePage /></LazyRoute> },
          { path: '/competitions', element: <LazyRoute><CompetitionsPage /></LazyRoute> },
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
              { path: 'notifications', element: <LazyRoute><NotificationCenter /></LazyRoute> },
              { path: 'announcements', element: <LazyRoute><AnnouncementsPage /></LazyRoute> },
              { path: 'challenges', element: <LazyRoute><InvestorWorkspacePage initialTab="challenges" /></LazyRoute> },
              {
                element: <RequireRole allowedRoles={[ROLES.INVESTOR]} />,
                children: [
                  { path: 'investor', element: <LazyRoute><InvestorWorkspacePage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={WORKSPACE_ROLES} />,
                children: [
                  { path: 'chat', element: <LazyRoute><ProjectChatPage /></LazyRoute> },
                  { path: 'projects', element: <LazyRoute><ProjectsListPage /></LazyRoute> },
                  { path: 'projects/:id', element: <LazyRoute><ProjectOverviewPage /></LazyRoute> },
                ],
              },
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
                  {
                    path: 'organization/colleges/:collegeId/rubrics',
                    element: <LazyRoute><RubricsPage /></LazyRoute>,
                  },
                  { path: 'users', element: <LazyRoute><UsersAdminPage /></LazyRoute> },
                  { path: 'audit-logs', element: <LazyRoute><AuditLogsPage /></LazyRoute> },
                  { path: 'reports/projects', element: <LazyRoute><ProjectReportsPage /></LazyRoute> },
                  { path: 'reports/completion', element: <LazyRoute><CompletionReportPage /></LazyRoute> },
                  { path: 'reports/supervisors', element: <LazyRoute><SupervisorDistributionPage /></LazyRoute> },
                  { path: 'reports/evaluation', element: <LazyRoute><EvaluationReportPage /></LazyRoute> },
                  { path: 'reports/insights', element: <LazyRoute><InsightsReportPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={REVIEW_ROLES} />,
                children: [
                  { path: 'reports', element: <LazyRoute><ReportsHomePage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={[ROLES.SUPERVISOR]} />,
                children: [
                  { path: 'reports/supervisor', element: <LazyRoute><SupervisorDashboardPage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={DEFENSE_ROLES} />,
                children: [
                  { path: 'defenses', element: <LazyRoute><DefenseSchedulingPage /></LazyRoute> },
                  { path: 'defenses/:id/grading', element: <LazyRoute><GradingWorkspacePage /></LazyRoute> },
                ],
              },
              {
                element: <RequireRole allowedRoles={COLLEGE_OR_UNI_ADMIN} />,
                children: [
                  { path: 'reevaluations', element: <LazyRoute><ReEvaluationQueuePage /></LazyRoute> },
                  { path: 'votes/flagged', element: <LazyRoute><FlaggedVotesPage /></LazyRoute> },
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
