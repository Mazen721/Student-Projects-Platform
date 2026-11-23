import { Helmet } from 'react-helmet-async';
import { Bookmark, Clock, Coins, Eye, Heart, ThumbsUp } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatCurrencyEgp, formatPercent } from '@/lib/format';
import { CardSkeleton, EmptyState } from '@/components/ui';
import { RtlBarChart, RtlDonutChart, RtlYoYChart } from '@/components/charts';
import { useReportInsightsQuery } from './reportsApi';
import { KpiTile, ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function InsightsReportPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportInsightsQuery(filters.queryParams);

  const current = data?.current || data;
  const comparison = data?.comparison || null;

  const fieldChartData = (current?.byField || []).map((item) => ({
    name: item.isOther ? ar.reports.otherCategory : t(`fields.${item.name}`),
    value: item.count,
  }));

  const techChartData = (current?.byTechnology || []).map((item) => ({
    name: item.isOther ? ar.reports.otherCategory : item.name,
    value: item.count,
  }));

  const contactData = current
    ? Object.entries(current.engagement?.contactRequestsByStatus || {})
        .map(([statusKey, value]) => ({
          name: t(`statuses.${statusKey}`),
          value,
        }))
        .filter((item) => item.value > 0)
    : [];

  const yoyData =
    comparison && current
      ? [
          {
            name: ar.reports.validVotes,
            current: current.engagement?.validVotes || 0,
            comparison: comparison.engagement?.validVotes || 0,
          },
          {
            name: ar.reports.uniqueViews,
            current: current.engagement?.uniqueViews || 0,
            comparison: comparison.engagement?.uniqueViews || 0,
          },
          {
            name: ar.reports.lateSubmissionRate,
            current: current.late?.percent || 0,
            comparison: comparison.late?.percent || 0,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.insights} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.reports.insights}</h1>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/insights"
        exportBasename={ar.reports.insights}
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
              label={ar.reports.totalBudget}
              formattedValue={formatCurrencyEgp(Number(current.budget?.total || 0))}
              icon={Coins}
            />
            <KpiTile
              label={ar.reports.meanBudget}
              formattedValue={formatCurrencyEgp(Number(current.budget?.mean || 0))}
              icon={Coins}
            />
            <KpiTile
              label={ar.reports.lateSubmissionRate}
              formattedValue={formatPercent(Number(current.late?.percent || 0))}
              icon={Clock}
            />
            <KpiTile
              label={ar.reports.validVotes}
              value={current.engagement?.validVotes || 0}
              icon={ThumbsUp}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              label={ar.reports.uniqueViews}
              value={current.engagement?.uniqueViews || 0}
              icon={Eye}
            />
            <KpiTile
              label={ar.reports.follows}
              value={current.engagement?.follows || 0}
              icon={Heart}
            />
            <KpiTile
              label={ar.reports.bookmarks}
              value={current.engagement?.bookmarks || 0}
              icon={Bookmark}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RtlBarChart
              title={ar.reports.byFieldTitle}
              data={fieldChartData}
              valueLabel={ar.reports.countLabel}
            />
            <RtlBarChart
              title={ar.reports.byTechnologyTitle}
              data={techChartData}
              valueLabel={ar.reports.countLabel}
              color="#c9a227"
            />
          </div>

          <RtlDonutChart title={ar.reports.contactRequestsByStatus} data={contactData} />

          {comparison && <RtlYoYChart title={ar.reports.yoyComparison} data={yoyData} />}
        </>
      )}
    </div>
  );
}
