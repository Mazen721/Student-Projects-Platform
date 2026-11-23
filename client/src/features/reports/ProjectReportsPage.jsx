import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import ar, { t } from '@/locales/ar';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  Badge,
  Card,
  CardSkeleton,
  EmptyState,
  Pagination,
  ResponsiveTable,
} from '@/components/ui';
import { useReportProjectsQuery } from './reportsApi';
import { ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function ProjectReportsPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportProjectsQuery({
    ...filters.queryParams,
    page: filters.page,
    limit: 20,
  });

  const columns = [
    {
      key: 'title',
      header: ar.reports.projectTitle,
      render: (row) => (
        <Link to={`/app/projects/${row.id}`} className="font-bold text-navy hover:underline">
          {row.title}
        </Link>
      ),
    },
    {
      key: 'college',
      header: ar.auth.college,
      render: (row) => row.college?.name || '—',
    },
    {
      key: 'department',
      header: ar.auth.department,
      render: (row) => row.department?.name || '—',
    },
    {
      key: 'field',
      header: ar.projects.field,
      render: (row) => (row.field ? t(`fields.${row.field}`) : '—'),
    },
    {
      key: 'supervisor',
      header: ar.showcase.supervisorLabel,
      render: (row) => row.supervisor?.name || '—',
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (row) => <Badge tone="info">{t(`statuses.${row.status}`)}</Badge>,
    },
    {
      key: 'progress',
      header: ar.reports.meanCompletion,
      render: (row) => formatPercent(Number(row.progress?.percent || 0)),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.projects} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.reports.projects}</h1>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/projects"
        exportBasename={ar.reports.projects}
        showProjectFilters
      />

      {data?.statusCounts && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.statusCounts).map(([statusKey, count]) => (
            <Badge key={statusKey} tone="info">
              {t(`statuses.${statusKey}`)} ({formatNumber(count)})
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <CardSkeleton />
      ) : !data ? (
        <EmptyState title={ar.common.noData} />
      ) : (
        <Card title={ar.reports.detailsSection}>
          <ResponsiveTable columns={columns} rows={data.items || []} />
          <div className="mt-4">
            <Pagination
              page={data.page || 1}
              pages={data.pages || 0}
              onPageChange={filters.setPage}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
