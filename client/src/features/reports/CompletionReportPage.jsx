import { Helmet } from 'react-helmet-async';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import ar from '@/locales/ar';
import { formatPercent } from '@/lib/format';
import { Card, CardSkeleton, EmptyState, ResponsiveTable } from '@/components/ui';
import { RtlBarChart, RtlDonutChart, RtlYoYChart } from '@/components/charts';
import { useReportCompletionQuery } from './reportsApi';
import { KpiTile, ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function CompletionReportPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportCompletionQuery(filters.queryParams);

  const current = data?.current || data;
  const comparison = data?.comparison || null;

  const statusDonutData = current
    ? [
        { name: ar.statuses.on_track, value: current.counts?.on_track || 0, color: '#15803d' },
        { name: ar.statuses.at_risk, value: current.counts?.at_risk || 0, color: '#b45309' },
        { name: ar.statuses.delayed, value: current.counts?.delayed || 0, color: '#b91c1c' },
      ].filter((item) => item.value > 0)
    : [];

  const phaseChartData = (current?.perPhase || []).map((ph) => ({
    name: ph.name,
    value: ph.meanPercent,
  }));

  const yoyData =
    comparison && current
      ? [
          {
            name: ar.reports.meanCompletion,
            current: current.meanPercent || 0,
            comparison: comparison.meanPercent || 0,
          },
          {
            name: ar.reports.onTrackCount,
            current: current.counts?.on_track || 0,
            comparison: comparison.counts?.on_track || 0,
          },
          {
            name: ar.reports.delayedCount,
            current: current.counts?.delayed || 0,
            comparison: comparison.counts?.delayed || 0,
          },
        ]
      : [];

  const childColumns = [
    { key: 'name', header: ar.reports.unitName },
    { key: 'projectCount', header: ar.reports.approvedProjects },
    {
      key: 'meanPercent',
      header: ar.reports.meanCompletion,
      render: (row) => formatPercent(Number(row.meanPercent || 0)),
    },
    {
      key: 'delayed',
      header: ar.reports.delayedCount,
      render: (row) => row.counts?.delayed || 0,
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.completion} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.reports.completion}</h1>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/completion"
        exportBasename={ar.reports.completion}
        computedAt={current?.computedAt}
        showCompare
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !current ? (
        <EmptyState title={ar.common.noData} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label={ar.reports.meanCompletion}
              formattedValue={formatPercent(Number(current.meanPercent || 0))}
              icon={TrendingUp}
            />
            <KpiTile
              label={ar.reports.onTrackCount}
              value={current.counts?.on_track || 0}
              icon={CheckCircle2}
            />
            <KpiTile
              label={ar.reports.atRiskCount}
              value={current.counts?.at_risk || 0}
              icon={AlertTriangle}
            />
            <KpiTile
              label={ar.reports.delayedCount}
              value={current.counts?.delayed || 0}
              icon={Clock}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RtlDonutChart title={ar.common.status} data={statusDonutData} />
            <RtlBarChart
              title={ar.reports.perPhaseCompletion}
              data={phaseChartData}
              valueLabel={ar.reports.meanCompletion}
              suffix="%"
            />
          </div>

          {comparison && (
            <RtlYoYChart
              title={ar.reports.yoyComparison}
              data={yoyData}
              currentLabel={ar.reports.currentYear}
              compareLabel={ar.reports.compareYearLabel}
            />
          )}

          {(current.byChild || []).length > 0 && (
            <Card title={ar.reports.byUnit}>
              <ResponsiveTable columns={childColumns} rows={current.byChild} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
