import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Eye, Send, ShieldAlert, X } from 'lucide-react';
import {
  ROLES,
  SHOWCASE_STATES,
  SHOWCASE_TEMPLATE_VALUES,
  SHOWCASE_THEME_VALUES,
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
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import {
  useDecideContactRequestMutation,
  useProjectContactRequestsQuery,
  useTeamShowcaseQuery,
  useTransitionShowcaseMutation,
  useUpdateTeamShowcaseMutation,
} from './showcaseApi';

const HIDEABLE_SECTIONS = [
  { key: 'problem', labelKey: 'showcase.problemSection' },
  { key: 'solution', labelKey: 'showcase.solutionSection' },
  { key: 'features', labelKey: 'showcase.featuresSection' },
  { key: 'technologies', labelKey: 'showcase.technologiesSection' },
  { key: 'components', labelKey: 'showcase.componentsSection' },
  { key: 'video', labelKey: 'showcase.videoSection' },
  { key: 'achievements', labelKey: 'showcase.achievementsSection' },
  { key: 'interest', labelKey: 'showcase.interestSection' },
];

const STATUS_TONE = {
  draft: 'neutral',
  pending_approval: 'warning',
  published: 'success',
  unpublished: 'neutral',
  taken_down: 'danger',
};

function toLines(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

function fromLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function fromComma(text) {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MiniSiteBuilderPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const projectId = project?.id || project?._id;
  const isLeader = String(project?.team?.leaderId) === String(user?.id);
  const isTeamMember = (project?.activeMemberIds || []).some(
    (id) => String(id) === String(user?.id)
  );
  const isSupervisorOrAdmin = roles.some((r) =>
    [
      ROLES.SUPERVISOR,
      ROLES.DEPARTMENT_ADMIN,
      ROLES.COLLEGE_ADMIN,
      ROLES.UNIVERSITY_ADMIN,
    ].includes(r.role)
  );

  const { data: showcase, isLoading } = useTeamShowcaseQuery(projectId);
  const updateMutation = useUpdateTeamShowcaseMutation(projectId);
  const transitionMutation = useTransitionShowcaseMutation(projectId);
  const { data: contactRequests = [] } = useProjectContactRequestsQuery(projectId, isTeamMember);
  const decideMutation = useDecideContactRequestMutation(projectId);

  const [form, setForm] = useState({
    template: 'classic',
    theme: 'navy_gold',
    slogan: '',
    problem: '',
    solution: '',
    featuresText: '',
    technologiesText: '',
    componentsText: '',
    videoUrl: '',
    achievementsText: '',
    interest: '',
    hiddenSections: [],
  });
  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [decideModal, setDecideModal] = useState(null);
  const [replyForm, setReplyForm] = useState({
    text: '',
    shareEmail: false,
    sharePhone: false,
    other: '',
  });

  useEffect(() => {
    if (!showcase) return;
    const s = showcase.sections || {};
    setForm({
      template: showcase.template || 'classic',
      theme: showcase.theme || 'navy_gold',
      slogan: s.hero?.slogan || '',
      problem: s.problem || '',
      solution: s.solution || '',
      featuresText: toLines(s.features),
      technologiesText: (s.technologies || []).join(', '),
      componentsText: (s.components || []).join(', '),
      videoUrl: s.video?.url || '',
      achievementsText: toLines(s.achievements),
      interest: s.interest || '',
      hiddenSections: showcase.hiddenSections || [],
    });
  }, [showcase]);

  if (isLoading || !showcase) return <CardSkeleton />;

  function toggleHidden(key) {
    setForm((prev) => {
      const exists = prev.hiddenSections.includes(key);
      return {
        ...prev,
        hiddenSections: exists
          ? prev.hiddenSections.filter((k) => k !== key)
          : [...prev.hiddenSections, key],
      };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const sections = {
        ...(form.slogan.trim() ? { hero: { slogan: form.slogan.trim() } } : {}),
        ...(form.problem.trim() ? { problem: form.problem.trim() } : {}),
        ...(form.solution.trim() ? { solution: form.solution.trim() } : {}),
        features: fromLines(form.featuresText),
        technologies: fromComma(form.technologiesText),
        components: fromComma(form.componentsText),
        ...(form.videoUrl.trim() ? { video: { url: form.videoUrl.trim() } } : {}),
        achievements: fromLines(form.achievementsText),
        ...(form.interest.trim() ? { interest: form.interest.trim() } : {}),
      };
      await updateMutation.mutateAsync({
        template: form.template,
        theme: form.theme,
        sections,
        hiddenSections: form.hiddenSections,
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleTransition(event, reason) {
    try {
      await transitionMutation.mutateAsync({ event, ...(reason ? { reason } : {}) });
      setReasonModal(null);
      setReasonText('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleDecide(decision) {
    if (!decideModal) return;
    try {
      const sharedContacts = {};
      if (replyForm.shareEmail && user?.email) sharedContacts.email = user.email;
      if (replyForm.sharePhone && user?.profile?.phone) sharedContacts.phone = user.profile.phone;
      if (replyForm.other.trim()) sharedContacts.other = replyForm.other.trim();

      await decideMutation.mutateAsync({
        id: decideModal.id,
        decision,
        ...(decision === 'accept'
          ? {
              reply: {
                text: replyForm.text.trim(),
                ...(Object.keys(sharedContacts).length > 0 ? { sharedContacts } : {}),
              },
            }
          : {}),
      });
      setDecideModal(null);
      setReplyForm({ text: '', shareEmail: false, sharePhone: false, other: '' });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const state = showcase.state;
  const canRequestPublish =
    isTeamMember &&
    [SHOWCASE_STATES.DRAFT, SHOWCASE_STATES.UNPUBLISHED, SHOWCASE_STATES.TAKEN_DOWN].includes(
      state
    );
  const canRepublish =
    isTeamMember && state === SHOWCASE_STATES.UNPUBLISHED && showcase.everApproved;
  const canUnpublish =
    (isTeamMember || isSupervisorOrAdmin) && state === SHOWCASE_STATES.PUBLISHED;
  const canApprove = isSupervisorOrAdmin && state === SHOWCASE_STATES.PENDING_APPROVAL;
  const canTakeDown =
    isSupervisorOrAdmin &&
    [SHOWCASE_STATES.PUBLISHED, SHOWCASE_STATES.UNPUBLISHED].includes(state);

  return (
    <div className="space-y-6">
      <Card title={ar.showcase.miniSiteBuilderTitle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted">{ar.common.status}</span>
            <Badge tone={STATUS_TONE[state] || 'neutral'}>{t(`statuses.${state}`)}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {state === SHOWCASE_STATES.PUBLISHED && (
              <Link
                to={`/p/${showcase.slug}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-app-bg"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{ar.showcase.viewLivePage}</span>
              </Link>
            )}
            {canRepublish && (
              <Button variant="gold" onClick={() => handleTransition('PUBLISH')}>
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                <span>{ar.showcase.republishPage}</span>
              </Button>
            )}
            {canRequestPublish && !canRepublish && (
              <Button variant="gold" onClick={() => handleTransition('REQUEST_PUBLISH')}>
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                <span>{ar.showcase.requestPublish}</span>
              </Button>
            )}
            {canApprove && (
              <>
                <Button variant="gold" onClick={() => handleTransition('APPROVE')}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.showcase.approvePublish}</span>
                </Button>
                <Button variant="outline" onClick={() => setReasonModal('REJECT_PUBLISH')}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.showcase.rejectPublish}</span>
                </Button>
              </>
            )}
            {canUnpublish && (
              <Button variant="outline" onClick={() => handleTransition('UNPUBLISH')}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span>{ar.showcase.unpublishPage}</span>
              </Button>
            )}
            {canTakeDown && (
              <Button variant="danger" onClick={() => setReasonModal('TAKE_DOWN')}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                <span>{ar.showcase.takeDownPage}</span>
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ar.showcase.templateLabel}>
              <Select
                value={form.template}
                onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
                placeholder={false}
                options={SHOWCASE_TEMPLATE_VALUES.map((val) => ({
                  value: val,
                  label: t(`showcase.templates.${val}`),
                }))}
              />
            </Field>
            <Field label={ar.showcase.themeLabel}>
              <Select
                value={form.theme}
                onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                placeholder={false}
                options={SHOWCASE_THEME_VALUES.map((val) => ({
                  value: val,
                  label: t(`showcase.themes.${val}`),
                }))}
              />
            </Field>
          </div>

          <Field label={ar.showcase.sloganLabel}>
            <Input
              value={form.slogan}
              onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={ar.showcase.problemSection}>
              <Textarea
                rows={3}
                value={form.problem}
                onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
              />
            </Field>
            <Field label={ar.showcase.solutionSection}>
              <Textarea
                rows={3}
                value={form.solution}
                onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={ar.showcase.featuresSection}>
              <Textarea
                rows={3}
                value={form.featuresText}
                onChange={(e) => setForm((f) => ({ ...f, featuresText: e.target.value }))}
              />
            </Field>
            <Field label={ar.showcase.achievementsSection}>
              <Textarea
                rows={3}
                value={form.achievementsText}
                onChange={(e) => setForm((f) => ({ ...f, achievementsText: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={ar.showcase.technologiesSection}>
              <Input
                value={form.technologiesText}
                onChange={(e) => setForm((f) => ({ ...f, technologiesText: e.target.value }))}
              />
            </Field>
            <Field label={ar.showcase.componentsSection}>
              <Input
                value={form.componentsText}
                onChange={(e) => setForm((f) => ({ ...f, componentsText: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={ar.showcase.videoUrlSection}>
              <Input
                dir="ltr"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
              />
            </Field>
            <Field label={ar.showcase.interestSection}>
              <Input
                value={form.interest}
                onChange={(e) => setForm((f) => ({ ...f, interest: e.target.value }))}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-navy">{ar.showcase.hiddenSectionsLabel}</p>
            <div className="flex flex-wrap gap-3">
              {HIDEABLE_SECTIONS.map((sec) => (
                <label
                  key={sec.key}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-app-bg px-3 py-1.5 text-xs font-bold text-ink"
                >
                  <input
                    type="checkbox"
                    checked={form.hiddenSections.includes(sec.key)}
                    onChange={() => toggleHidden(sec.key)}
                  />
                  <span>{t(sec.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          {isTeamMember && (
            <Button type="submit" variant="navy" loading={updateMutation.isPending}>
              {ar.common.save}
            </Button>
          )}
        </form>
      </Card>

      {isTeamMember && contactRequests.length > 0 && (
        <Card title={ar.showcase.contactRequestsTitle}>
          <div className="space-y-3">
            {contactRequests.map((reqItem) => (
              <div
                key={reqItem.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-app-bg p-4 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy">{reqItem.investorName}</span>
                    <Badge
                      tone={
                        reqItem.state === 'accepted'
                          ? 'success'
                          : reqItem.state === 'declined'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {t(`statuses.${reqItem.state}`)}
                    </Badge>
                  </div>
                  <p className="text-ink">{reqItem.message}</p>
                </div>
                {isLeader && reqItem.state === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => setDecideModal(reqItem)}
                    >
                      {ar.showcase.acceptRequest}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decideMutation.mutate({ id: reqItem.id, decision: 'decline' })
                      }
                    >
                      {ar.showcase.declineRequest}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(reasonModal)}
        onClose={() => setReasonModal(null)}
        title={
          reasonModal === 'TAKE_DOWN'
            ? ar.showcase.takeDownPage
            : ar.showcase.rejectPublish
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTransition(reasonModal, reasonText);
          }}
          className="space-y-4"
        >
          <Field label={ar.showcase.reasonLabel} required>
            <Textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReasonModal(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={transitionMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(decideModal)}
        onClose={() => setDecideModal(null)}
        title={ar.showcase.acceptRequest}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDecide('accept');
          }}
          className="space-y-4"
        >
          <Field label={ar.showcase.replyTextLabel} required>
            <Textarea
              rows={3}
              value={replyForm.text}
              onChange={(e) => setReplyForm((r) => ({ ...r, text: e.target.value }))}
            />
          </Field>
          <div className="space-y-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={replyForm.shareEmail}
                onChange={(e) => setReplyForm((r) => ({ ...r, shareEmail: e.target.checked }))}
              />
              <span>{ar.showcase.shareEmailOption}</span>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={replyForm.sharePhone}
                onChange={(e) => setReplyForm((r) => ({ ...r, sharePhone: e.target.checked }))}
              />
              <span>{ar.showcase.sharePhoneOption}</span>
            </label>
            <Field label={ar.showcase.shareOtherContactLabel}>
              <Input
                value={replyForm.other}
                onChange={(e) => setReplyForm((r) => ({ ...r, other: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDecideModal(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={decideMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
