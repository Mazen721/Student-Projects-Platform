import { Helmet } from 'react-helmet-async';
import { Award, CheckCircle2, GraduationCap, TrendingUp } from 'lucide-react';
import { GRADE_BAND_VALUES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { formatNumber, formatPercent } from '@/lib/format';
import { Card, CardSkeleton, EmptyState, ResponsiveTable } from '@/components/ui';
import { RtlBarChart, RtlYoYChart } from '@/components/charts';
import { useReportEvaluationQuery } from './reportsApi';
import { KpiTile, ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function EvaluationReportPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportEvaluationQuery(filters.queryParams);

  const current = data?.current || data;
  const comparison = data?.comparison || null;

  const bandsData = current
    ? GRADE_BAND_VALUES.map((bandKey) => ({
        name: t(`gradeBands.${bandKey}`),
        value: current.bands?.[bandKey] || 0,
      }))
    : [];

  const yoyData =
    comparison && current
      ? GRADE_BAND_VALUES.map((bandKey) => ({
          name: t(`gradeBands.${bandKey}`),
          current: current.bands?.[bandKey] || 0,
          comparison: comparison.bands?.[bandKey] || 0,
        }))
      : [];

  const childColumns = [
    { key: 'name', header: ar.reports.unitName },
    { key: 'students', header: ar.reports.studentsEvaluated },
    {
      key: 'mean',
      header: ar.reports.meanGrade,
      render: (row) => formatNumber(Number(row.mean || 0), { decimals: 1 }),
    },
    {
      key: 'passRate',
      header: ar.reports.passRate,
      render: (row) => formatPercent(Number(row.passRate || 0)),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.evaluation} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.reports.evaluation}</h1>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/evaluation"
        exportBasename={ar.reports.evaluation}
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
              label={ar.reports.studentsEvaluated}
              value={current.students || 0}
              icon={GraduationCap}
            />
            <KpiTile
              label={ar.reports.meanGrade}
              formattedValue={formatNumber(Number(current.mean || 0), { decimals: 1 })}
              icon={TrendingUp}
            />
            <KpiTile
              label={ar.reports.passRate}
              formattedValue={formatPercent(Number(current.passRate || 0))}
              icon={CheckCircle2}
            />
            <KpiTile
              label={ar.reports.maxGrade}
              formattedValue={`${formatNumber(Number(current.min || 0), { decimals: 1 })} / ${formatNumber(Number(current.max || 0), { decimals: 1 })}`}
              icon={Award}
            />
          </div>

          <RtlBarChart
            title={ar.reports.gradeBandsTitle}
            data={bandsData}
            valueLabel={ar.reports.countLabel}
          />

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
