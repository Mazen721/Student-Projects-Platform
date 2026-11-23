import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Check, ShieldAlert, X } from 'lucide-react';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';
import {
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Pagination,
  ResponsiveTable,
} from '@/components/ui';
import { useFlaggedVotesQuery, useReviewFlaggedVoteMutation } from './showcaseApi';

export default function FlaggedVotesPage() {
  const addToast = useUiStore((s) => s.addToast);
  const [page, setPage] = useState(1);

  const { data: res, isLoading } = useFlaggedVotesQuery({ page, limit: 20 });
  const reviewMutation = useReviewFlaggedVoteMutation();

  if (isLoading) return <CardSkeleton />;

  const votes = res?.data || [];
  const pageMeta = res?.page;

  async function handleReview(id, decision) {
    try {
      await reviewMutation.mutateAsync({ id, decision });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const columns = [
    {
      key: 'projectTitle',
      header: ar.showcase.projectCol,
      render: (row) =>
        row.projectSlug ? (
          <Link to={`/p/${row.projectSlug}`} className="font-bold text-navy hover:underline">
            {row.projectTitle || row.projectId}
          </Link>
        ) : (
          row.projectTitle || row.projectId
        ),
    },
    { key: 'voterName', header: ar.showcase.voterCol },
    {
      key: 'createdAt',
      header: ar.showcase.dateCol,
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="gold"
            onClick={() => handleReview(row.id, 'clear')}
            loading={reviewMutation.isPending}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{ar.showcase.clearVote}</span>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleReview(row.id, 'reject')}
            loading={reviewMutation.isPending}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{ar.showcase.rejectVote}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.showcase.flaggedVotesTitle} — ${ar.common.platformName}`} />

      <header className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <ShieldAlert className="h-7 w-7 text-gold" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold">{ar.showcase.flaggedVotesTitle}</h1>
      </header>

      <Card>
        {votes.length === 0 ? (
          <EmptyState icon={ShieldAlert} title={ar.showcase.noFlaggedVotes} />
        ) : (
          <div className="space-y-4">
            <ResponsiveTable columns={columns} rows={votes} />
            {pageMeta && pageMeta.pages > 1 && (
              <Pagination
                page={pageMeta.page}
                pages={pageMeta.pages}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
