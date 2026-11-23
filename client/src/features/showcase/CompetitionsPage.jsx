import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, ThumbsUp, Trophy } from 'lucide-react';
import { ROLES, VOTER_RESTRICTIONS } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
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
  ResponsiveTable,
  Select,
} from '@/components/ui';
import {
  useCompetitionVoteMutation,
  useCreateCompetitionMutation,
  usePublicCompetitionsQuery,
  usePublicProjectsQuery,
} from './showcaseApi';

const STATE_TONE = {
  scheduled: 'warning',
  open: 'success',
  closed: 'neutral',
};

export default function CompetitionsPage() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const accessToken = useAuthStore((s) => s.accessToken);
  const addToast = useUiStore((s) => s.addToast);

  const isAdmin = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN].includes(r.role)
  );
  const isUniversityAdmin = roles.some((r) => r.role === ROLES.UNIVERSITY_ADMIN);
  const collegeId = roles.find((r) => r.collegeId)?.collegeId;

  const { data: competitions = [], isLoading } = usePublicCompetitionsQuery();
  const { data: publicProjectsRes } = usePublicProjectsQuery({ limit: 50 });
  const createMutation = useCreateCompetitionMutation();
  const voteMutation = useCompetitionVoteMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    scopeType: isUniversityAdmin ? 'university' : 'college',
    voterRestriction: VOTER_RESTRICTIONS.ALL,
    startsAt: '',
    endsAt: '',
    eligibleProjectIds: [],
  });

  if (isLoading) return <CardSkeleton />;

  const publicProjects = publicProjectsRes?.data || [];

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        title: form.title,
        scopeType: form.scopeType,
        ...(form.scopeType === 'college' && collegeId ? { scopeId: collegeId } : {}),
        voterRestriction: form.voterRestriction,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        eligibleProjectIds: form.eligibleProjectIds,
      });
      setCreateOpen(false);
      setForm({
        title: '',
        scopeType: isUniversityAdmin ? 'university' : 'college',
        voterRestriction: VOTER_RESTRICTIONS.ALL,
        startsAt: '',
        endsAt: '',
        eligibleProjectIds: [],
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleVote(competitionId, projectId) {
    try {
      await voteMutation.mutateAsync({ competitionId, projectId });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  function toggleEligible(id) {
    setForm((prev) => ({
      ...prev,
      eligibleProjectIds: prev.eligibleProjectIds.includes(id)
        ? prev.eligibleProjectIds.filter((pid) => pid !== id)
        : [...prev.eligibleProjectIds, id],
    }));
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.showcase.competitionsTitle} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-gold" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-extrabold">{ar.showcase.competitionsTitle}</h1>
            <p className="text-sm text-gold-light">{ar.showcase.homeSubtitle}</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="gold" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.showcase.createCompetition}</span>
          </Button>
        )}
      </header>

      {competitions.length === 0 ? (
        <EmptyState icon={Trophy} title={ar.showcase.noCompetitionsYet} />
      ) : (
        <div className="space-y-6">
          {competitions.map((comp) => {
            const rows =
              comp.state === 'closed' && comp.frozenRanking?.length > 0
                ? comp.frozenRanking
                : comp.ranking || [];
            const columns = [
              {
                key: 'rank',
                header: ar.showcase.rankCol,
                render: (row) => formatNumber(row.rank),
              },
              {
                key: 'title',
                header: ar.showcase.projectCol,
                render: (row) =>
                  row.slug ? (
                    <Link to={`/p/${row.slug}`} className="font-bold text-navy hover:underline">
                      {row.title || row.projectId}
                    </Link>
                  ) : (
                    row.title || row.projectId
                  ),
              },
              {
                key: 'votes',
                header: ar.showcase.votesCol,
                render: (row) => formatNumber(row.votes || 0),
              },
              ...(comp.state === 'open' && accessToken && user
                ? [
                    {
                      key: 'actions',
                      header: ar.common.actions,
                      render: (row) => (
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => handleVote(comp.id, row.projectId)}
                          loading={voteMutation.isPending}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ar.showcase.vote}</span>
                        </Button>
                      ),
                    },
                  ]
                : []),
            ];

            return (
              <Card key={comp.id} title={comp.title}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATE_TONE[comp.state] || 'neutral'}>
                      {t(`statuses.${comp.state}`)}
                    </Badge>
                    <span>
                      {comp.voterRestriction === VOTER_RESTRICTIONS.UNIVERSITY_ONLY
                        ? ar.showcase.voterUniversityOnly
                        : ar.showcase.voterAll}
                    </span>
                    {comp.state === 'closed' && (
                      <Badge tone="featured">{ar.showcase.frozenRankingLabel}</Badge>
                    )}
                  </div>
                  <span>
                    {formatDateTime(comp.startsAt)} — {formatDateTime(comp.endsAt)}
                  </span>
                </div>

                <ResponsiveTable
                  columns={columns}
                  rows={rows}
                  rowKey={(r) => `${comp.id}-${r.projectId}`}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={ar.showcase.createCompetition}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label={ar.showcase.competitionTitleLabel} required>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>

          <Field label={ar.showcase.voterRestrictionLabel}>
            <Select
              value={form.voterRestriction}
              onChange={(e) => setForm((f) => ({ ...f, voterRestriction: e.target.value }))}
              placeholder={false}
              options={[
                { value: VOTER_RESTRICTIONS.ALL, label: ar.showcase.voterAll },
                {
                  value: VOTER_RESTRICTIONS.UNIVERSITY_ONLY,
                  label: ar.showcase.voterUniversityOnly,
                },
              ]}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.showcase.startsAtLabel} required>
              <Input
                type="datetime-local"
                dir="ltr"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </Field>
            <Field label={ar.showcase.endsAtLabel} required>
              <Input
                type="datetime-local"
                dir="ltr"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </Field>
          </div>

          {publicProjects.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-navy">{ar.showcase.eligibleProjectsLabel}</p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2.5">
                {publicProjects.map((proj) => (
                  <label
                    key={proj.id}
                    className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-bold text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={form.eligibleProjectIds.includes(proj.id)}
                      onChange={() => toggleEligible(proj.id)}
                    />
                    <span>{proj.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createMutation.isPending}>
              {ar.common.create}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
