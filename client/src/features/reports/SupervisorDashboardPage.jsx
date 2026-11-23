import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Download, FolderKanban, TrendingUp, Users } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatPercent } from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ProgressBar,
  ResponsiveTable,
} from '@/components/ui';
import { RtlDonutChart } from '@/components/charts';
import { downloadReportFile, useSupervisorSelfReportQuery } from './reportsApi';
import { KpiTile } from './ReportFiltersBar';
import { ReportsSubNav } from './ReportsSubNav';

function flagTone(flag) {
  if (flag === 'delayed') return 'danger';
  if (flag === 'at_risk') return 'warning';
  return 'success';
}

function ProjectGroupCard({ title, rows = [] }) {
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
      key: 'department',
      header: ar.auth.department,
      render: (row) => row.department?.name || '—',
    },
    {
      key: 'progressPercent',
      header: ar.reports.meanCompletion,
      render: (row) => <ProgressBar value={row.progressPercent || 0} className="min-w-28" />,
    },
    {
      key: 'statusFlag',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={flagTone(row.statusFlag)}>{t(`statuses.${row.statusFlag}`)}</Badge>
      ),
    },
  ];

  return (
    <Card title={title}>
      <ResponsiveTable columns={columns} rows={rows} />
    </Card>
  );
}

export default function SupervisorDashboardPage() {
  const addToast = useUiStore((s) => s.addToast);
  const { data, isLoading } = useSupervisorSelfReportQuery();
  const [downloading, setDownloading] = useState('');

  async function handleExport(format) {
    setDownloading(format);
    try {
      await downloadReportFile({
        endpoint: '/reports/supervisor/me',
        params: {},
        format,
        fallbackFilename: `${ar.reports.supervisorDashboard}.${format}`,
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    } finally {
      setDownloading('');
    }
  }

  const flagData = data
    ? [
        {
          name: ar.statuses.on_track,
          value: data.summary?.countsByFlag?.on_track || 0,
          color: '#15803d',
        },
        {
          name: ar.statuses.at_risk,
          value: data.summary?.countsByFlag?.at_risk || 0,
          color: '#b45309',
        },
        {
          name: ar.statuses.delayed,
          value: data.summary?.countsByFlag?.delayed || 0,
          color: '#b91c1c',
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.reports.supervisorDashboard} — ${ar.common.platformName}`} />

      <section className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{ar.reports.supervisorDashboard}</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              loading={downloading === 'xlsx'}
              onClick={() => handleExport('xlsx')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{ar.reports.exportExcel}</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={downloading === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{ar.reports.exportPdf}</span>
            </Button>
          </div>
        </div>
      </section>

      <ReportsSubNav />

      {isLoading ? (
        <CardSkeleton />
      ) : !data ? (
        <EmptyState title={ar.common.noData} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label={ar.reports.totalSupervised}
              value={data.summary?.totalProjects || 0}
              icon={FolderKanban}
            />
            <KpiTile
              label={ar.reports.primaryCount}
              value={data.summary?.primaryCount || 0}
              icon={Users}
            />
            <KpiTile
              label={ar.reports.coCount}
              value={data.summary?.coCount || 0}
              icon={Users}
            />
            <KpiTile
              label={ar.reports.meanCompletion}
              formattedValue={formatPercent(Number(data.summary?.meanProgress || 0))}
              icon={TrendingUp}
            />
          </div>

          <RtlDonutChart title={ar.common.status} data={flagData} />

          <ProjectGroupCard
            title={ar.reports.primarySupervision}
            rows={data.primaryProjects || []}
          />
          <ProjectGroupCard
            title={ar.reports.coSupervision}
            rows={data.coSupervisedProjects || []}
          />
          <ProjectGroupCard title={ar.reports.mentoring} rows={data.mentoredProjects || []} />
        </>
      )}
    </div>
  );
}
