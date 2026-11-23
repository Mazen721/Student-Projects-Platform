import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ar from '@/locales/ar';
import { formatDateTime } from '@/lib/format';
import { CardSkeleton, Input, Pagination, ResponsiveTable } from '@/components/ui';
import { useAuditLogsQuery } from './orgApi';

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data: res, isLoading } = useAuditLogsQuery({
    action: action || undefined,
    page,
    limit: 20,
  });

  const logs = res?.data || [];
  const pageMeta = res?.page;

  const columns = [
    {
      key: 'action',
      header: ar.org.auditAction,
      render: (row) => (
        <span dir="ltr" className="inline-block font-bold text-navy [unicode-bidi:isolate]">
          {row.action}
        </span>
      ),
    },
    { key: 'targetType', header: ar.org.auditTarget },
    { key: 'reason', header: ar.org.auditReason, render: (row) => row.reason || '—' },
    { key: 'at', header: ar.org.auditTime, render: (row) => formatDateTime(row.at) },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.auditLogs} — ${ar.common.platformName}`} />

      <h1 className="text-2xl font-extrabold text-navy">{ar.org.auditLogs}</h1>

      <Input
        placeholder={ar.org.auditAction}
        dir="ltr"
        value={action}
        onChange={(e) => {
          setAction(e.target.value);
          setPage(1);
        }}
      />

      {isLoading ? (
        <CardSkeleton />
      ) : (
        <>
          <ResponsiveTable columns={columns} rows={logs} />
          <Pagination
            page={pageMeta?.page || 1}
            pages={pageMeta?.pages || 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
