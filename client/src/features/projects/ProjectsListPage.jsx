import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, FolderKanban, Lightbulb, Plus, Users } from 'lucide-react';
import {
  PROJECT_FIELD_VALUES,
  PROPOSAL_STATUS_VALUES,
  ROLES,
} from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Input,
  Pagination,
  ProgressBar,
  Select,
} from '@/components/ui';
import {
  useMyTeamInvitationsQuery,
  useProjectsQuery,
  useRespondTeamInvitationMutation,
} from './projectsApi';
import { getProposalStatusTone } from './statusTone';

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const isStudent = roles.some((r) => r.role === ROLES.STUDENT);
  const isSupervisor = roles.some((r) => r.role === ROLES.SUPERVISOR);
  const isAdmin = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
  );

  const [filters, setFilters] = useState({ q: '', status: '', field: '', page: 1 });
  const { data: projectsRes, isLoading } = useProjectsQuery({
    page: filters.page,
    limit: 12,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.field ? { field: filters.field } : {}),
  });
  const { data: invitations = [] } = useMyTeamInvitationsQuery(isStudent);
  const respondInvitation = useRespondTeamInvitationMutation();

  const projects = projectsRes?.data || [];
  const pageMeta = projectsRes?.page;

  async function handleInvitation(id, decision) {
    try {
      const res = await respondInvitation.mutateAsync({ id, decision });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
      if (decision === 'accept' && res?.projectId) {
        navigate(`/app/projects/${res.projectId}`);
      }
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.projects.pageTitle} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold">{ar.projects.pageTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStudent && (
            <Button variant="gold" onClick={() => navigate('/app/projects/new')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.projects.newProposal}</span>
            </Button>
          )}
          {(isSupervisor || isAdmin) && (
            <Link
              to="/app/projects/reviews"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              <span>{ar.projects.reviewQueue}</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/app/supervisors/load"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>{ar.projects.supervisorLoad}</span>
            </Link>
          )}
          <Link
            to="/app/ideas"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>{ar.nav.ideas}</span>
          </Link>
        </div>
      </header>

      {isStudent && invitations.length > 0 && (
        <Card title={ar.projects.pendingInvitations}>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3 text-sm"
              >
                <div>
                  <p className="font-extrabold text-navy">{inv.project?.title}</p>
                  <p className="text-xs text-muted">{inv.invitedByUser?.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleInvitation(inv.id, 'decline')}
                    loading={respondInvitation.isPending}
                  >
                    {ar.projects.declineInvite}
                  </Button>
                  <Button
                    variant="gold"
                    onClick={() => handleInvitation(inv.id, 'accept')}
                    loading={respondInvitation.isPending}
                  >
                    {ar.projects.acceptInvite}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={ar.common.search} id="projects-search">
            <Input
              id="projects-search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              placeholder={ar.projects.searchPlaceholder}
            />
          </Field>

          <Field label={ar.common.status} id="projects-status-filter">
            <Select
              id="projects-status-filter"
              placeholder={ar.common.all}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              {PROPOSAL_STATUS_VALUES.map((st) => (
                <option key={st} value={st}>
                  {t(`statuses.${st}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={ar.projects.field} id="projects-field-filter">
            <Select
              id="projects-field-filter"
              placeholder={ar.common.all}
              value={filters.field}
              onChange={(e) => setFilters((f) => ({ ...f, field: e.target.value, page: 1 }))}
            >
              {PROJECT_FIELD_VALUES.map((val) => (
                <option key={val} value={val}>
                  {t(`projects.fields.${val}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {isLoading ? (
        <CardSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={ar.projects.noProjectsYet}
          actionLabel={isStudent ? ar.projects.newProposal : undefined}
          onAction={isStudent ? () => navigate('/app/projects/new') : undefined}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/app/projects/${project.id}`}
                      className="text-base font-extrabold text-navy hover:underline"
                    >
                      {project.title}
                    </Link>
                    <Badge tone={getProposalStatusTone(project.status)}>
                      {t(`statuses.${project.status}`)}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted">
                    {project.college?.name} · {project.department?.name} ·{' '}
                    {project.supervisor?.name || ar.projects.noSupervisorYet}
                  </p>

                  <ProgressBar
                    value={project.progress?.percent || 0}
                    label={ar.tracking.completionPercent}
                  />
                </div>
              </Card>
            ))}
          </div>

          {pageMeta && (
            <Pagination
              page={pageMeta.page}
              pages={pageMeta.pages}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          )}
        </>
      )}
    </div>
  );
}
