import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Edit3, Send } from 'lucide-react';
import { PROPOSAL_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  Modal,
  ProgressBar,
  Tabs,
} from '@/components/ui';
import { ProposalHistoryPanel } from './ProposalHistoryPanel';
import { TeamManagementPanel } from './TeamManagementPanel';
import { ProjectPhasesPage } from '@/features/tracking/ProjectPhasesPage';
import { KanbanBoardPage } from '@/features/tracking/KanbanBoardPage';
import { BomToolsPage } from '@/features/tracking/BomToolsPage';
import { MeetingsPage } from '@/features/tracking/MeetingsPage';
import { ProjectTimelinePage } from '@/features/tracking/ProjectTimelinePage';
import ProjectChatPage from '@/features/collaboration/ProjectChatPage';
import { MediaGalleryPage } from '@/features/collaboration/MediaGalleryPage';
import { ProjectDefensePanel } from '@/features/evaluation/DefenseSchedulingPage';
import { StudentGradePage } from '@/features/evaluation/StudentGradePage';
import { MiniSiteBuilderPage } from '@/features/showcase/MiniSiteBuilderPage';
import { useProjectQuery, useTransitionProposalMutation } from './projectsApi';
import { getProposalStatusTone } from './statusTone';

export default function ProjectOverviewPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const { data: project, isLoading } = useProjectQuery(id);
  const transitionMutation = useTransitionProposalMutation();
  const [activeTab, setActiveTab] = useState('proposal');
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (isLoading || !project) {
    return <CardSkeleton />;
  }

  const isLeader = String(project.team?.leaderId) === String(user?.id);
  const canEdit =
    isLeader &&
    [PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.NEEDS_CHANGES].includes(project.status);
  const canSubmit = isLeader && project.status === PROPOSAL_STATUSES.DRAFT;
  const canResubmit = isLeader && project.status === PROPOSAL_STATUSES.NEEDS_CHANGES;
  const canWithdraw =
    isLeader &&
    [
      PROPOSAL_STATUSES.DRAFT,
      PROPOSAL_STATUSES.SUBMITTED,
      PROPOSAL_STATUSES.NEEDS_CHANGES,
    ].includes(project.status);

  async function handleTransition(event) {
    try {
      await transitionMutation.mutateAsync({ id: project.id, event });
      setWithdrawOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const isTrackingActive = [PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED].includes(
    project.status
  );

  const tabs = [
    { value: 'proposal', label: ar.projects.proposal },
    { value: 'team', label: ar.projects.team },
    ...(isTrackingActive
      ? [
          { value: 'phases', label: ar.tracking.phases },
          { value: 'kanban', label: ar.tracking.kanban },
          { value: 'bom', label: ar.tracking.bom },
          { value: 'meetings', label: ar.tracking.meetings },
          { value: 'timeline', label: ar.tracking.timeline },
          { value: 'chat', label: ar.nav.chat },
          { value: 'media', label: ar.chat.mediaGallery },
          { value: 'defense', label: ar.evaluation.defense },
          { value: 'grades', label: ar.evaluation.grades },
          { value: 'showcase', label: ar.showcase.miniSiteTab },
        ]
      : []),
    { value: 'history', label: ar.projects.historyAndVersions },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${project.title} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{project.title}</h1>
              <Badge tone={getProposalStatusTone(project.status)}>
                {t(`statuses.${project.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-gold-light">
              {project.college?.name} · {project.department?.name} ·{' '}
              <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                {project.academicYearLabel}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link
                to={`/app/projects/${project.id}/edit`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                <span>{ar.projects.editProposal}</span>
              </Link>
            )}
            {canSubmit && (
              <Button
                variant="gold"
                onClick={() => handleTransition('SUBMIT')}
                loading={transitionMutation.isPending}
              >
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                <span>{ar.projects.submitProposal}</span>
              </Button>
            )}
            {canResubmit && (
              <Button
                variant="gold"
                onClick={() => handleTransition('RESUBMIT')}
                loading={transitionMutation.isPending}
              >
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                <span>{ar.projects.resubmitProposal}</span>
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
                {ar.projects.withdrawProposal}
              </Button>
            )}
          </div>
        </div>
      </header>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-muted">{ar.projects.supervision}</p>
            <p className="mt-1 text-sm font-bold text-navy">
              {project.supervisor?.name || ar.projects.noSupervisorYet}
            </p>
          </div>
          <ProgressBar
            value={project.progress?.percent || 0}
            label={ar.tracking.completionPercent}
          />
        </div>
      </Card>

      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'proposal' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={ar.projects.idea}>
            <p className="whitespace-pre-line text-sm text-ink">{project.idea}</p>
          </Card>
          <Card title={ar.projects.problem}>
            <p className="whitespace-pre-line text-sm text-ink">{project.problem}</p>
          </Card>
          <Card title={ar.projects.scope}>
            <p className="whitespace-pre-line text-sm text-ink">{project.scope}</p>
          </Card>
          <Card title={ar.projects.expectedOutcomes}>
            <p className="whitespace-pre-line text-sm text-ink">{project.expectedOutcomes}</p>
          </Card>
          <Card title={ar.projects.objectives}>
            <ul className="list-disc space-y-1 ps-5 text-sm text-ink">
              {(project.objectives || []).map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </Card>
          <Card title={ar.common.details}>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-bold text-muted">{ar.projects.field}: </span>
                <span className="font-bold text-navy">
                  {t(`projects.fields.${project.field}`)}
                </span>
              </p>
              <p>
                <span className="font-bold text-muted">{ar.projects.type}: </span>
                <span className="font-bold text-navy">{t(`projects.types.${project.type}`)}</span>
              </p>
              <p>
                <span className="font-bold text-muted">{ar.projects.beneficiaries}: </span>
                <span className="text-ink">{project.beneficiaries}</span>
              </p>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'team' && <TeamManagementPanel project={project} />}

      {activeTab === 'phases' && <ProjectPhasesPage project={project} />}

      {activeTab === 'kanban' && <KanbanBoardPage project={project} />}

      {activeTab === 'bom' && <BomToolsPage project={project} />}

      {activeTab === 'meetings' && <MeetingsPage project={project} />}

      {activeTab === 'timeline' && <ProjectTimelinePage projectId={project.id} />}

      {activeTab === 'chat' && <ProjectChatPage project={project} />}

      {activeTab === 'media' && <MediaGalleryPage project={project} />}

      {activeTab === 'defense' && <ProjectDefensePanel project={project} />}

      {activeTab === 'grades' && <StudentGradePage project={project} />}

      {activeTab === 'showcase' && <MiniSiteBuilderPage project={project} />}

      {activeTab === 'history' && <ProposalHistoryPanel projectId={project.id} />}

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title={ar.projects.withdrawProposal}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">{ar.projects.withdrawConfirm}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button
              variant="navy"
              onClick={() => handleTransition('WITHDRAW')}
              loading={transitionMutation.isPending}
            >
              {ar.common.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
