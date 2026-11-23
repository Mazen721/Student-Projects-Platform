import { useState } from 'react';
import { History } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, CardSkeleton, EmptyState, Modal } from '@/components/ui';
import { useProjectHistoryQuery, useProposalVersionQuery } from './projectsApi';
import { getProposalStatusTone } from './statusTone';

export function ProposalHistoryPanel({ projectId }) {
  const { data, isLoading } = useProjectHistoryQuery(projectId);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const { data: snapshotDoc, isLoading: snapshotLoading } = useProposalVersionQuery(
    projectId,
    selectedVersion
  );

  if (isLoading) {
    return <CardSkeleton />;
  }

  const history = data?.history || [];
  const versions = data?.versions || [];

  return (
    <div className="space-y-6">
      <Card title={ar.projects.transitionTimeline}>
        {history.length === 0 ? (
          <EmptyState icon={History} title={ar.common.noData} />
        ) : (
          <ol className="space-y-3">
            {history.map((entry, idx) => (
              <li
                key={`${entry.event}-${entry.at}-${idx}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line bg-app-bg p-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={getProposalStatusTone(entry.to)}>
                      {t(`statuses.${entry.to}`)}
                    </Badge>
                    <span className="font-bold text-navy">{entry.actorName || entry.actorRole}</span>
                  </div>
                  {entry.comment && <p className="text-ink">{entry.comment}</p>}
                </div>
                <span className="text-xs text-muted">{formatDateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {versions.length > 0 && (
        <Card title={ar.projects.historyAndVersions}>
          <div className="grid gap-3 sm:grid-cols-2">
            {versions.map((ver) => (
              <div
                key={ver.version}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3"
              >
                <div>
                  <p className="font-extrabold text-navy">
                    {t('projects.versionLabel', { version: ver.version })}
                  </p>
                  <p className="text-xs text-muted">
                    {ver.authorName} · {formatDateTime(ver.createdAt)}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedVersion(ver.version)}>
                  {ar.projects.viewSnapshot}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selectedVersion)}
        onClose={() => setSelectedVersion(null)}
        title={t('projects.versionLabel', { version: selectedVersion || '' })}
      >
        {snapshotLoading || !snapshotDoc ? (
          <CardSkeleton />
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-bold text-muted">{ar.projects.title}</p>
              <p className="font-bold text-navy">{snapshotDoc.snapshot?.title}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">{ar.projects.idea}</p>
              <p className="text-ink">{snapshotDoc.snapshot?.idea}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">{ar.projects.problem}</p>
              <p className="text-ink">{snapshotDoc.snapshot?.problem}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">{ar.projects.scope}</p>
              <p className="text-ink">{snapshotDoc.snapshot?.scope}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">{ar.projects.expectedOutcomes}</p>
              <p className="text-ink">{snapshotDoc.snapshot?.expectedOutcomes}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
