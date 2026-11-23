import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import { PROJECT_FIELD_VALUES, ROLES, USER_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
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
  Modal,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { PublicProjectCard } from './PublicProjectCard';
import {
  useChallengesQuery,
  useCreateChallengeMutation,
  useMyBookmarksQuery,
  useMyContactRequestsQuery,
  useMyFollowsQuery,
  useRemoveChallengeMutation,
} from './showcaseApi';

export default function InvestorWorkspacePage({ initialTab = 'challenges' }) {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const isInvestor = roles.some((r) => r.role === ROLES.INVESTOR);
  const isActiveInvestor = isInvestor && user?.status === USER_STATUSES.ACTIVE;
  const isAdmin = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN].includes(r.role)
  );

  const [activeTab, setActiveTab] = useState(isInvestor ? 'follows' : initialTab);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    description: '',
    field: PROJECT_FIELD_VALUES[0],
  });

  const { data: follows = [], isLoading: followsLoading } = useMyFollowsQuery();
  const { data: bookmarks = [], isLoading: bookmarksLoading } = useMyBookmarksQuery();
  const { data: requests = [], isLoading: requestsLoading } = useMyContactRequestsQuery();
  const { data: challenges = [], isLoading: challengesLoading } = useChallengesQuery();

  const createChallenge = useCreateChallengeMutation();
  const removeChallenge = useRemoveChallengeMutation();

  const tabs = [
    ...(isInvestor
      ? [
          { value: 'follows', label: ar.showcase.followedProjects },
          { value: 'bookmarks', label: ar.showcase.bookmarkedProjects },
          { value: 'requests', label: ar.showcase.myContactRequestsTitle },
        ]
      : []),
    { value: 'challenges', label: ar.showcase.challenges },
  ];

  async function handleCreateChallenge(e) {
    e.preventDefault();
    try {
      await createChallenge.mutateAsync(challengeForm);
      setChallengeOpen(false);
      setChallengeForm({ title: '', description: '', field: PROJECT_FIELD_VALUES[0] });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRemoveChallenge(e) {
    e.preventDefault();
    if (!removeTarget) return;
    try {
      await removeChallenge.mutateAsync({ id: removeTarget, reason: removeReason });
      setRemoveTarget(null);
      setRemoveReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.showcase.investorWorkspaceTitle} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <Briefcase className="h-7 w-7 text-gold" aria-hidden="true" />
          <h1 className="text-2xl font-extrabold">{ar.showcase.investorWorkspaceTitle}</h1>
        </div>
        {isActiveInvestor && (
          <Button variant="gold" onClick={() => setChallengeOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.showcase.createChallenge}</span>
          </Button>
        )}
      </header>

      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'follows' && (
        <Card title={ar.showcase.followedProjects}>
          {followsLoading ? (
            <CardSkeleton />
          ) : follows.length === 0 ? (
            <EmptyState title={ar.common.noData} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {follows.map((proj) => (
                <PublicProjectCard key={proj.id} project={proj} />
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'bookmarks' && (
        <Card title={ar.showcase.bookmarkedProjects}>
          {bookmarksLoading ? (
            <CardSkeleton />
          ) : bookmarks.length === 0 ? (
            <EmptyState title={ar.common.noData} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bookmarks.map((proj) => (
                <PublicProjectCard key={proj.id} project={proj} />
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card title={ar.showcase.myContactRequestsTitle}>
          {requestsLoading ? (
            <CardSkeleton />
          ) : requests.length === 0 ? (
            <EmptyState title={ar.common.noData} />
          ) : (
            <div className="space-y-3">
              {requests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className="space-y-2 rounded-xl border border-line bg-app-bg p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {reqItem.project?.slug ? (
                      <Link
                        to={`/p/${reqItem.project.slug}`}
                        className="font-bold text-navy hover:underline"
                      >
                        {reqItem.project.title}
                      </Link>
                    ) : (
                      <span className="font-bold text-navy">{reqItem.projectId}</span>
                    )}
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
                  {reqItem.reply && (
                    <div className="rounded-xl border border-line bg-white p-3 space-y-1">
                      <p className="font-bold text-navy">{reqItem.reply.text}</p>
                      {reqItem.reply.sharedContacts && (
                        <div className="space-y-1 text-xs text-muted">
                          <p className="font-bold">{ar.showcase.sharedContactsLabel}</p>
                          {reqItem.reply.sharedContacts.email && (
                            <p>
                              <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                                {reqItem.reply.sharedContacts.email}
                              </span>
                            </p>
                          )}
                          {reqItem.reply.sharedContacts.phone && (
                            <p>
                              <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                                {reqItem.reply.sharedContacts.phone}
                              </span>
                            </p>
                          )}
                          {reqItem.reply.sharedContacts.other && (
                            <p>{reqItem.reply.sharedContacts.other}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'challenges' && (
        <Card title={ar.showcase.challenges}>
          {challengesLoading ? (
            <CardSkeleton />
          ) : challenges.length === 0 ? (
            <EmptyState title={ar.showcase.noChallengesYet} />
          ) : (
            <div className="space-y-3">
              {challenges.map((ch) => (
                <div
                  key={ch.id}
                  className="space-y-2 rounded-xl border border-line bg-app-bg p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-navy">{ch.title}</h3>
                      <Badge tone="info">{t(`projects.fields.${ch.field}`)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{formatDateTime(ch.createdAt)}</span>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRemoveTarget(ch.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ar.showcase.removeChallenge}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-line text-ink">{ch.description}</p>
                  {ch.investorName && <p className="text-xs font-bold text-muted">{ch.investorName}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={challengeOpen}
        onClose={() => setChallengeOpen(false)}
        title={ar.showcase.createChallenge}
      >
        <form onSubmit={handleCreateChallenge} className="space-y-4">
          <Field label={ar.showcase.challengeTitleLabel} required>
            <Input
              value={challengeForm.title}
              onChange={(e) => setChallengeForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label={ar.projects.field} required>
            <Select
              value={challengeForm.field}
              onChange={(e) => setChallengeForm((f) => ({ ...f, field: e.target.value }))}
              placeholder={false}
              options={PROJECT_FIELD_VALUES.map((v) => ({
                value: v,
                label: t(`projects.fields.${v}`),
              }))}
            />
          </Field>
          <Field label={ar.showcase.challengeDescriptionLabel} required>
            <Textarea
              rows={4}
              value={challengeForm.description}
              onChange={(e) => setChallengeForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setChallengeOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createChallenge.isPending}>
              {ar.common.create}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={ar.showcase.removeChallenge}
      >
        <form onSubmit={handleRemoveChallenge} className="space-y-4">
          <Field label={ar.showcase.reasonLabel} required>
            <Textarea
              rows={3}
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={removeChallenge.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
