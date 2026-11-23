import { useState } from 'react';
import { Clock } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatDateTime } from '@/lib/format';
import { Card, CardSkeleton, EmptyState, Pagination } from '@/components/ui';
import { useProjectTimelineQuery } from './trackingApi';

export function ProjectTimelinePage({ projectId }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectTimelineQuery(projectId, { page, limit: 20 });

  if (isLoading) return <CardSkeleton />;

  const events = data?.data || [];
  const meta = data?.page;

  return (
    <Card title={ar.tracking.timeline}>
      {events.length === 0 ? (
        <EmptyState title={ar.tracking.noTimelineEvents} />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-3 rounded-xl border border-line bg-app-bg p-3"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold text-navy">{t(ev.summaryKey, ev.data)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{ev.actorName}</span>
                  <span>·</span>
                  <span>{formatDateTime(ev.at)}</span>
                </div>
              </div>
            </div>
          ))}
          {meta && <Pagination page={meta.page} pages={meta.pages} onPageChange={setPage} />}
        </div>
      )}
    </Card>
  );
}
