import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { PROPOSAL_STATUSES, ROLES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useActiveRole } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Modal,
  Textarea,
} from '@/components/ui';
import { useProjectsQuery, useTransitionProposalMutation } from './projectsApi';
import { getProposalStatusTone } from './statusTone';

export default function ProposalReviewPage() {
  const activeRole = useActiveRole();
  const addToast = useUiStore((s) => s.addToast);

  const isSupervisor = activeRole === ROLES.SUPERVISOR;
  const isAdmin = [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(
    activeRole
  );

  const { data: submittedRes, isLoading: loadingSub } = useProjectsQuery({
    status: PROPOSAL_STATUSES.SUBMITTED,
    limit: 50,
  });
  const { data: reviewRes, isLoading: loadingRev } = useProjectsQuery({
    status: PROPOSAL_STATUSES.UNDER_REVIEW,
    limit: 50,
  });
  const { data: recRes, isLoading: loadingRec } = useProjectsQuery({
    status: PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
    limit: 50,
  });

  const transitionMutation = useTransitionProposalMutation();
  const [modalAction, setModalAction] = useState(null);
  const [comment, setComment] = useState('');

  if (loadingSub || loadingRev || loadingRec) {
    return <CardSkeleton />;
  }

  const queueItems = [
    ...(submittedRes?.data || []),
    ...(reviewRes?.data || []),
    ...(isAdmin ? recRes?.data || [] : []),
  ];

  async function runDirectTransition(projectId, event) {
    try {
      await transitionMutation.mutateAsync({ id: projectId, event });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleModalSubmit(e) {
    e.preventDefault();
    if (!modalAction) return;
    try {
      await transitionMutation.mutateAsync({
        id: modalAction.project.id,
        event: modalAction.event,
        comment: comment.trim() || undefined,
      });
      setModalAction(null);
      setComment('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.projects.reviewQueue} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.projects.reviewQueue}</h1>
      </header>

      {queueItems.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={ar.projects.noProjectsYet} />
      ) : (
        <div className="space-y-4">
          {queueItems.map((project) => (
            <Card key={project.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/app/projects/${project.id}`}
                      className="text-lg font-extrabold text-navy hover:underline"
                    >
                      {project.title}
                    </Link>
                    <Badge tone={getProposalStatusTone(project.status)}>
                      {t(`statuses.${project.status}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {project.college?.name} · {project.department?.name}
                  </p>
                  <p className="text-sm text-ink">{project.idea}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.status === PROPOSAL_STATUSES.SUBMITTED && (isSupervisor || isAdmin) && (
                    <Button
                      variant="navy"
                      onClick={() => runDirectTransition(project.id, 'START_REVIEW')}
                      loading={transitionMutation.isPending}
                    >
                      {ar.projects.startReview}
                    </Button>
                  )}

                  {project.status === PROPOSAL_STATUSES.UNDER_REVIEW && isSupervisor && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setComment('');
                          setModalAction({ project, event: 'REQUEST_CHANGES', required: true });
                        }}
                      >
                        {ar.projects.requestChanges}
                      </Button>
                      <Button
                        variant="gold"
                        onClick={() => {
                          setComment('');
                          setModalAction({ project, event: 'RECOMMEND', required: true });
                        }}
                      >
                        {ar.projects.recommendApproval}
                      </Button>
                    </>
                  )}

                  {project.status === PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED && isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setComment('');
                          setModalAction({ project, event: 'RETURN', required: false });
                        }}
                      >
                        {ar.projects.returnForChanges}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setComment('');
                          setModalAction({ project, event: 'REJECT', required: true });
                        }}
                      >
                        {ar.projects.rejectProposal}
                      </Button>
                      <Button
                        variant="gold"
                        onClick={() => runDirectTransition(project.id, 'APPROVE')}
                        loading={transitionMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>{ar.projects.approveProposal}</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        title={modalAction?.project?.title}
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
          <Field
            label={ar.projects.reviewComment}
            id="review-comment"
            required={modalAction?.required}
          >
            <Textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required={modalAction?.required}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalAction(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={transitionMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
