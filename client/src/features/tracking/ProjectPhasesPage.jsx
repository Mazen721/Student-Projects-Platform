import { useState } from 'react';
import { Calendar, CheckCircle2, FileText, History, Plus, RotateCcw, Upload } from 'lucide-react';
import {
  DELIVERABLE_STATUSES,
  LINK_KIND_VALUES,
  PROPOSAL_STATUSES,
  STATUS_FLAG_VALUES,
} from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  FileUploader,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from '@/components/ui';
import {
  useAddMilestoneMutation,
  useAdjustPhaseMutation,
  useCompletePhaseMutation,
  useCreateSubmissionMutation,
  useDeliverableSubmissionsQuery,
  useProjectPhasesQuery,
  useReopenPhaseMutation,
  useReviewSubmissionMutation,
  useUpdateStatusFlagMutation,
} from './trackingApi';
import { CommentThread } from '@/features/collaboration/CommentThread';

function getDeliverableTone(status) {
  switch (status) {
    case DELIVERABLE_STATUSES.APPROVED:
      return 'success';
    case DELIVERABLE_STATUSES.SUBMITTED:
      return 'warning';
    case DELIVERABLE_STATUSES.CHANGES_REQUESTED:
    case DELIVERABLE_STATUSES.REJECTED:
      return 'danger';
    default:
      return 'info';
  }
}

function getStatusFlagTone(flag) {
  if (flag === 'on_track') return 'success';
  if (flag === 'at_risk') return 'warning';
  return 'danger';
}

function SubmissionHistoryModal({ projectId, deliverable, isPrimarySupervisor, onClose }) {
  const addToast = useUiStore((s) => s.addToast);
  const { data: submissions = [], isLoading } = useDeliverableSubmissionsQuery(
    projectId,
    deliverable?.id
  );
  const reviewMutation = useReviewSubmissionMutation();
  const [decision, setDecision] = useState('approved');
  const [comment, setComment] = useState('');

  async function handleReview(submissionId, chosenDecision) {
    try {
      await reviewMutation.mutateAsync({
        submissionId,
        projectId,
        deliverableId: deliverable.id,
        decision: chosenDecision,
        comment: comment.trim() || undefined,
      });
      setComment('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <Modal open={Boolean(deliverable)} onClose={onClose} title={deliverable?.title || ''}>
      {isLoading ? (
        <CardSkeleton />
      ) : submissions.length === 0 ? (
        <EmptyState title={ar.tracking.submissions} />
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-line bg-app-bg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-navy">
                    {t('tracking.versionLabel', { version: formatNumber(sub.version) })}
                  </span>
                  {sub.isLatest && <Badge tone="featured">{ar.tracking.latestBadge}</Badge>}
                  {sub.isLate && <Badge tone="danger">{ar.tracking.lateBadge}</Badge>}
                  {sub.review?.decision && (
                    <Badge tone={getDeliverableTone(sub.review.decision)}>
                      {t(`statuses.${sub.review.decision}`)}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted">{formatDateTime(sub.submittedAt)}</span>
              </div>

              {sub.note && <p className="text-sm text-ink">{sub.note}</p>}

              {(sub.files || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sub.files.map((f, idx) => (
                    <a
                      key={idx}
                      href={f.signedUrl || f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-navy border border-line"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{f.originalName || ar.tracking.downloadForm}</span>
                    </a>
                  ))}
                </div>
              )}

              {(sub.links || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sub.links.map((lnk, idx) => (
                    <a
                      key={idx}
                      href={lnk.url}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-navy border border-line [unicode-bidi:isolate]"
                    >
                      <span>{lnk.title || lnk.url}</span>
                    </a>
                  ))}
                </div>
              )}

              {sub.review?.comment && (
                <p className="rounded-lg bg-white p-2 text-xs text-ink border border-line">
                  {sub.review.comment}
                </p>
              )}

              {isPrimarySupervisor && sub.isLatest && (
                <div className="mt-2 space-y-2 border-t border-line pt-2">
                  <Field label={ar.tracking.reviewComment} id={`rev-comment-${sub.id}`}>
                    <Textarea
                      id={`rev-comment-${sub.id}`}
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={ar.tracking.reviewDecision}
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    >
                      <option value="approved">{ar.tracking.approveDeliverable}</option>
                      <option value="changes_requested">{ar.tracking.requestChanges}</option>
                      <option value="rejected">{ar.tracking.rejectDeliverable}</option>
                    </Select>
                    <Button
                      size="sm"
                      variant="navy"
                      loading={reviewMutation.isPending}
                      onClick={() => handleReview(sub.id, decision)}
                    >
                      {ar.tracking.reviewSubmission}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {deliverable?.id && (
        <div className="mt-4">
          <CommentThread targetType="deliverable" targetId={deliverable.id} />
        </div>
      )}
    </Modal>
  );
}

export function ProjectPhasesPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const { data, isLoading } = useProjectPhasesQuery(project.id);

  const adjustPhase = useAdjustPhaseMutation();
  const completePhase = useCompletePhaseMutation();
  const reopenPhase = useReopenPhaseMutation();
  const addMilestone = useAddMilestoneMutation();
  const createSubmission = useCreateSubmissionMutation();
  const updateStatusFlag = useUpdateStatusFlagMutation();

  const [submitTarget, setSubmitTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustDate, setAdjustDate] = useState('');
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [milestoneTarget, setMilestoneTarget] = useState(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');

  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkKind, setLinkKind] = useState('github');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [note, setNote] = useState('');

  const isTeamMember = (project.activeMemberIds || []).includes(String(user?.id));
  const isPrimarySupervisor =
    String(project.supervision?.primaryId || '') === String(user?.id || '');
  const isArchived = project.status === PROPOSAL_STATUSES.ARCHIVED;

  if (isLoading) return <CardSkeleton />;

  const phases = data?.phases || [];
  const progress = data?.progress || project.progress || { percent: 0 };

  if (phases.length === 0) {
    return <EmptyState title={ar.tracking.phases} description={ar.tracking.noPhasesYet} />;
  }

  function addLinkEntry() {
    if (!linkUrl.trim()) return;
    setLinks((prev) => [
      ...prev,
      {
        kind: linkKind,
        url: linkUrl.trim(),
        ...(linkTitle.trim() ? { title: linkTitle.trim() } : {}),
      },
    ]);
    setLinkUrl('');
    setLinkTitle('');
  }

  async function handleSubmissionSubmit(e) {
    e.preventDefault();
    try {
      await createSubmission.mutateAsync({
        projectId: project.id,
        deliverableId: submitTarget.id,
        files,
        links,
        note: note.trim(),
      });
      setSubmitTarget(null);
      setFiles([]);
      setLinks([]);
      setNote('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleAdjustPhase(e) {
    e.preventDefault();
    try {
      await adjustPhase.mutateAsync({
        projectId: project.id,
        phaseId: adjustTarget.id,
        dueDate: new Date(adjustDate).toISOString(),
      });
      setAdjustTarget(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleCompletePhase(phaseId) {
    try {
      await completePhase.mutateAsync({ projectId: project.id, phaseId });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleReopenPhase(e) {
    e.preventDefault();
    try {
      await reopenPhase.mutateAsync({
        projectId: project.id,
        phaseId: reopenTarget.id,
        reason: reopenReason,
      });
      setReopenTarget(null);
      setReopenReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleAddMilestone(e) {
    e.preventDefault();
    try {
      await addMilestone.mutateAsync({
        projectId: project.id,
        phaseId: milestoneTarget.id,
        title: milestoneTitle,
        dueDate: new Date(milestoneDate).toISOString(),
      });
      setMilestoneTarget(null);
      setMilestoneTitle('');
      setMilestoneDate('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleFlagChange(nextFlag) {
    try {
      await updateStatusFlag.mutateAsync({ projectId: project.id, statusFlag: nextFlag });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[240px] flex-1">
            <ProgressBar value={progress.percent || 0} label={ar.tracking.completionPercent} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted">{ar.tracking.statusFlagLabel}</span>
            <Badge tone={getStatusFlagTone(project.statusFlag)}>
              {t(`statuses.${project.statusFlag || 'on_track'}`)}
            </Badge>
            {isPrimarySupervisor && !isArchived && (
              <Select
                aria-label={ar.tracking.statusFlagLabel}
                value={project.statusFlag || 'on_track'}
                onChange={(e) => handleFlagChange(e.target.value)}
              >
                {STATUS_FLAG_VALUES.map((flag) => (
                  <option key={flag} value={flag}>
                    {t(`statuses.${flag}`)}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </Card>

      {phases.map((phase) => (
        <Card
          key={phase.id}
          title={`${phase.name} (${formatNumber(phase.weight)}%)`}
          subtitle={`${ar.tracking.dueDate}: ${formatDate(phase.dueDate)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{formatPercent(phase.percent || 0, { decimals: 0 })}</Badge>
              {isPrimarySupervisor && !isArchived && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdjustTarget(phase);
                      setAdjustDate(new Date(phase.dueDate).toISOString().slice(0, 10));
                    }}
                  >
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.tracking.adjustDueDate}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMilestoneTarget(phase);
                      setMilestoneTitle('');
                      setMilestoneDate('');
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.tracking.addMilestone}</span>
                  </Button>
                  {phase.requiredCount === 0 && !phase.completedBySupervisor && (
                    <Button
                      size="sm"
                      variant="navy"
                      onClick={() => handleCompletePhase(phase.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>{ar.tracking.markPhaseComplete}</span>
                    </Button>
                  )}
                  {phase.requiredCount === 0 && phase.completedBySupervisor && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReopenTarget(phase)}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>{ar.tracking.reopenPhase}</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {(phase.forms || []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted">{ar.tracking.officialForms}</span>
                {phase.forms.map((form, idx) => (
                  <a
                    key={idx}
                    href={form.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-app-bg px-3 text-xs font-bold text-navy"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>{form.originalName || ar.tracking.downloadForm}</span>
                  </a>
                ))}
              </div>
            )}

            {(phase.deliverables || []).length > 0 && (
              <div className="space-y-2">
                {phase.deliverables.map((deliv) => {
                  const canSubmit =
                    isTeamMember &&
                    !isArchived &&
                    deliv.latestStatus !== DELIVERABLE_STATUSES.APPROVED;

                  return (
                    <div
                      key={deliv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-navy">{deliv.title}</span>
                          <Badge tone={getDeliverableTone(deliv.latestStatus)}>
                            {t(`statuses.${deliv.latestStatus}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted">
                          {ar.tracking.dueDate}
                          {': '}
                          {formatDate(deliv.dueDate)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoryTarget(deliv)}
                        >
                          <History className="h-4 w-4" aria-hidden="true" />
                          <span>{ar.tracking.submissions}</span>
                        </Button>
                        {canSubmit && (
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() => {
                              setSubmitTarget(deliv);
                              setFiles([]);
                              setLinks([]);
                              setNote('');
                            }}
                          >
                            <Upload className="h-4 w-4" aria-hidden="true" />
                            <span>{ar.tracking.submitDeliverable}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(phase.milestones || []).length > 0 && (
              <div className="space-y-1 border-t border-line pt-3">
                <p className="text-xs font-bold text-muted">{ar.tracking.milestones}</p>
                <div className="flex flex-wrap gap-2">
                  {phase.milestones.map((m, idx) => (
                    <Badge key={m._id || idx} tone="info">
                      {m.title}
                      {' · '}
                      {formatDate(m.dueDate)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}

      <Modal
        open={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title={submitTarget ? `${ar.tracking.submitDeliverable}: ${submitTarget.title}` : ''}
      >
        <form onSubmit={handleSubmissionSubmit} className="space-y-4">
          <div className="space-y-2">
            <span className="block text-sm font-bold text-navy">{ar.tracking.attachments}</span>
            <FileUploader
              purpose="deliverable"
              projectId={project.id}
              onUploaded={(res) => setFiles((prev) => [...prev, res])}
              onError={(msg) => addToast({ message: msg, tone: 'error' })}
            />
            {files.length > 0 && (
              <p className="text-xs font-semibold text-navy">
                {files.map((f) => f.original_filename).join(' · ')}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <span className="block text-sm font-bold text-navy">{ar.tracking.externalLinks}</span>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                aria-label={ar.tracking.linkKind}
                value={linkKind}
                onChange={(e) => setLinkKind(e.target.value)}
              >
                {LINK_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <Input
                dir="ltr"
                aria-label={ar.tracking.linkUrl}
                placeholder={ar.tracking.linkUrl}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <Input
                aria-label={ar.tracking.linkLabel}
                placeholder={ar.tracking.linkLabel}
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addLinkEntry}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.addLink}</span>
            </Button>
            {links.length > 0 && (
              <ul className="space-y-1 text-xs text-ink">
                {links.map((l, idx) => (
                  <li key={idx} dir="ltr" className="[unicode-bidi:isolate]">
                    {l.kind}
                    {': '}
                    {l.url}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label={ar.tracking.submissionNote} id="sub-note">
            <Textarea
              id="sub-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSubmitTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createSubmission.isPending}>
              {ar.tracking.submitDeliverable}
            </Button>
          </div>
        </form>
      </Modal>

      <SubmissionHistoryModal
        projectId={project.id}
        deliverable={historyTarget}
        isPrimarySupervisor={isPrimarySupervisor && !isArchived}
        onClose={() => setHistoryTarget(null)}
      />

      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={ar.tracking.adjustDueDate}
      >
        <form onSubmit={handleAdjustPhase} className="space-y-4">
          <Field label={ar.tracking.dueDate} id="adjust-due" required>
            <Input
              id="adjust-due"
              type="date"
              value={adjustDate}
              onChange={(e) => setAdjustDate(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={adjustPhase.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(reopenTarget)}
        onClose={() => setReopenTarget(null)}
        title={ar.tracking.reopenPhase}
      >
        <form onSubmit={handleReopenPhase} className="space-y-4">
          <Field label={ar.tracking.reopenReason} id="reopen-reason" required>
            <Input
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReopenTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={reopenPhase.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(milestoneTarget)}
        onClose={() => setMilestoneTarget(null)}
        title={ar.tracking.addMilestone}
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <Field label={ar.tracking.taskTitle} id="ms-title" required>
            <Input
              id="ms-title"
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              required
            />
          </Field>
          <Field label={ar.tracking.dueDate} id="ms-date" required>
            <Input
              id="ms-date"
              type="date"
              value={milestoneDate}
              onChange={(e) => setMilestoneDate(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMilestoneTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={addMilestone.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
