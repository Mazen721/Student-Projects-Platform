import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, FolderKanban, TrendingUp } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatPercent } from '@/lib/format';
import { Badge, Button, Card, CardSkeleton, EmptyState, ProgressBar, ResponsiveTable } from '@/components/ui';
import { RtlBarChart } from '@/components/charts';
import { useReportDashboardQuery } from './reportsApi';
import { KpiTile, ReportFiltersBar, useReportFilterState } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

export default function AnalyticsDashboardPage() {
  const filters = useReportFilterState();
  const { data, isLoading } = useReportDashboardQuery(filters.queryParams);

  const scopeTitle =
    data?.scopeType === 'university'
      ? ar.reports.universityScope
      : data?.scopeType === 'college'
        ? ar.reports.collegeScope
        : data?.scopeType === 'department'
          ? ar.reports.departmentScope
          : ar.reports.projectScope;

  const childRows = (data?.children || []).map((child) => ({
    ...child,
    approvedCount: child.kpis?.approvedProjects ?? 1,
    totalCount: child.kpis?.totalProjects ?? 1,
    meanCompletion:
      child.kpis?.meanCompletion !== undefined
        ? child.kpis.meanCompletion
        : child.kpis?.progressPercent ?? 0,
  }));

  const chartData = childRows.map((row) => ({
    name: row.name,
    value: data?.scopeType === 'department' ? row.meanCompletion : row.approvedCount,
  }));

  const tableColumns = [
    {
      key: 'name',
      header: ar.reports.unitName,
      render: (row) =>
        row.scopeType === 'project' ? (
          <Link to={`/app/projects/${row.id}`} className="font-bold text-navy hover:underline">
            {row.name}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (row.scopeType === 'college') filters.setCollegeId(row.id);
              if (row.scopeType === 'department') filters.setDepartmentId(row.id);
            }}
            className="font-bold text-navy hover:underline cursor-pointer"
          >
            {row.name}
          </button>
        ),
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={row.status === 'deactivated' ? 'danger' : 'info'}>
          {row.status ? t(`statuses.${row.status}`) : ar.statuses.active}
        </Badge>
      ),
    },
    {
      key: 'approvedCount',
      header: ar.reports.approvedProjects,
    },
    {
      key: 'meanCompletion',
      header: ar.reports.meanCompletion,
      render: (row) => formatPercent(Number(row.meanCompletion || 0)),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.dashboard} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{ar.reports.dashboard}</h1>
            <p className="mt-1 text-sm text-gold-light">{scopeTitle}</p>
          </div>
          {((filters.isUniversityAdmin && filters.collegeId) || filters.departmentId) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (filters.departmentId) filters.setDepartmentId('');
                else if (filters.isUniversityAdmin) filters.setCollegeId('');
              }}
            >
              {ar.reports.backUpLevel}
            </Button>
          )}
        </div>
      </section>

      <ReportsSubNav />

      <ReportFiltersBar
        filters={filters}
        endpoint="/reports/dashboard"
        exportBasename={ar.reports.dashboard}
        computedAt={data?.computedAt}
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !data ? (
        <EmptyState title={ar.common.noData} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label={ar.reports.totalProjects}
              value={data.kpis?.totalProjects || 0}
              icon={FolderKanban}
            />
            <KpiTile
              label={ar.reports.approvedProjects}
              value={data.kpis?.approvedProjects || 0}
              icon={CheckCircle2}
            />
            <KpiTile
              label={ar.reports.meanCompletion}
              formattedValue={formatPercent(Number(data.kpis?.meanCompletion || 0))}
              icon={TrendingUp}
            />
            <KpiTile
              label={ar.reports.passRate}
              formattedValue={formatPercent(Number(data.kpis?.passRate || 0))}
              icon={Award}
            />
          </div>

          <RtlBarChart
            title={ar.reports.drillDown}
            subtitle={scopeTitle}
            data={chartData}
            valueLabel={
              data.scopeType === 'department'
                ? ar.reports.meanCompletion
                : ar.reports.approvedProjects
            }
            suffix={data.scopeType === 'department' ? '%' : ''}
          />

          <Card title={ar.reports.byUnit}>
            <ResponsiveTable columns={tableColumns} rows={childRows} />
          </Card>

          {data.storageUsage && (
            <Card title={ar.reports.storageUsageTitle}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">
                  {t('reports.storageUsageMetric', {
                    used: data.storageUsage.usedMb,
                    limit: data.storageUsage.limitMb,
                    percent: data.storageUsage.percent,
                  })}
                </span>
                <Badge
                  tone={
                    data.storageUsage.level === 'critical'
                      ? 'danger'
                      : data.storageUsage.level === 'warning'
                        ? 'warning'
                        : 'success'
                  }
                >
                  {data.storageUsage.level === 'critical'
                    ? ar.reports.storageStatusCritical
                    : data.storageUsage.level === 'warning'
                      ? ar.reports.storageStatusWarning
                      : ar.reports.storageStatusNormal}
                </Badge>
              </div>
              <div className="mt-3">
                <ProgressBar value={data.storageUsage.percent} />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
