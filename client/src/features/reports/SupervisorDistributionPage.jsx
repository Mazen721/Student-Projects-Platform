import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { AlertCircle, Users } from 'lucide-react';
import ar from '@/locales/ar';
import { Badge, Card, CardSkeleton, EmptyState, ResponsiveTable } from '@/components/ui';
import { RtlStackedBarChart, RtlYoYChart } from '@/components/charts';
import { useReportSupervisorsQuery } from './reportsApi';
import { KpiTile, ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function SupervisorDistributionPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportSupervisorsQuery(filters.queryParams);

  const current = data?.current || data;
  const comparison = data?.comparison || null;

  const supervisors = current?.supervisors || [];
  const chartData = supervisors.map((s) => ({
    name: s.name,
    primary: s.primary,
    remaining: s.remaining,
    co: s.co,
  }));

  const supColumns = [
    { key: 'name', header: ar.reports.supervisorName },
    { key: 'primary', header: ar.reports.primaryCount },
    { key: 'cap', header: ar.reports.capacity },
    { key: 'co', header: ar.reports.coCount },
    { key: 'remaining', header: ar.reports.remainingCapacity },
    {
      key: 'overCap',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={row.overCap ? 'danger' : 'success'}>
          {row.overCap ? ar.reports.overCapBadge : ar.reports.withinCapBadge}
        </Badge>
      ),
    },
  ];

  const unassignedColumns = [
    {
      key: 'title',
      header: ar.reports.projectTitle,
      render: (row) => (
        <Link to={`/app/projects/${row.id}`} className="font-bold text-navy hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: 'collegeName', header: ar.auth.college },
    { key: 'departmentName', header: ar.auth.department },
  ];

  const yoyData =
    comparison && current
      ? [
          {
            name: ar.reports.unassignedProjects,
            current: current.unassigned?.count || 0,
            comparison: comparison.unassigned?.count || 0,
          },
          {
            name: ar.reports.primaryCount,
            current: (current.supervisors || []).reduce((sum, s) => sum + s.primary, 0),
            comparison: (comparison.supervisors || []).reduce((sum, s) => sum + s.primary, 0),
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.supervisors} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.reports.supervisors}</h1>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/supervisor-distribution"
        exportBasename={ar.reports.supervisors}
        computedAt={current?.computedAt}
        showCompare
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !current ? (
        <EmptyState title={ar.common.noData} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiTile
              label={ar.reports.supervisorName}
              value={supervisors.length}
              icon={Users}
            />
            <KpiTile
              label={ar.reports.unassignedProjects}
              value={current.unassigned?.count || 0}
              icon={AlertCircle}
            />
          </div>

          <RtlStackedBarChart
            title={ar.reports.supervisors}
            data={chartData}
            series={[
              { key: 'primary', label: ar.reports.primaryCount, color: '#122f4a' },
              { key: 'remaining', label: ar.reports.remainingCapacity, color: '#c9a227' },
              { key: 'co', label: ar.reports.coCount, color: '#5b6b7c' },
            ]}
          />

          {comparison && <RtlYoYChart title={ar.reports.yoyComparison} data={yoyData} />}

          <Card title={ar.reports.supervisors}>
            <ResponsiveTable columns={supColumns} rows={supervisors} />
          </Card>

          <Card title={ar.reports.unassignedListTitle}>
            <ResponsiveTable
              columns={unassignedColumns}
              rows={current.unassigned?.projects || []}
              emptyMessage={ar.reports.noUnassignedProjects}
            />
          </Card>
        </>
      )}
    </div>
  );
}
