import { t } from '@spp/shared/locales/ar';
import { createRtlWorkbook, sendExcelResponse } from '../../core/export/excel.js';
import {
  createArabicPdf,
  drawRtlTable,
  drawRtlText,
  sendPdfResponse,
} from '../../core/export/pdf.js';

function unwrapCompare(result) {
  if (result && Object.hasOwn(result, 'current')) {
    return { current: result.current, comparison: result.comparison || null };
  }
  return { current: result, comparison: null };
}

function formatNum(value) {
  return typeof value === 'number' ? value : Number(value || 0);
}

function buildDashboardExport(result) {
  const kpis = result.kpis || {};
  return {
    title: t('reports.dashboard'),
    filenameBase: 'لوحة-التحليلات',
    metadataRows: [
      [t('reports.totalProjects'), formatNum(kpis.totalProjects)],
      [t('reports.approvedProjects'), formatNum(kpis.approvedProjects)],
      [t('reports.meanCompletion'), `${formatNum(kpis.meanCompletion)}%`],
      [t('reports.delayedCount'), formatNum(kpis.delayedProjects)],
      [t('reports.meanGrade'), formatNum(kpis.meanGrade)],
      [t('reports.passRate'), `${formatNum(kpis.passRate)}%`],
    ],
    columns: [
      { key: 'name', header: t('reports.unitName'), width: 32 },
      { key: 'status', header: t('common.status'), width: 18 },
      { key: 'totalProjects', header: t('reports.totalProjects'), width: 16 },
      { key: 'approvedProjects', header: t('reports.approvedProjects'), width: 16 },
      { key: 'meanCompletion', header: t('reports.meanCompletion'), width: 18 },
    ],
    rows: (result.children || []).map((child) => ({
      name: child.name || '',
      status: child.status ? t(`statuses.${child.status}`) : '',
      totalProjects: child.kpis?.totalProjects ?? 1,
      approvedProjects: child.kpis?.approvedProjects ?? 1,
      meanCompletion:
        child.kpis?.meanCompletion !== undefined
          ? `${child.kpis.meanCompletion}%`
          : `${child.kpis?.progressPercent ?? 0}%`,
    })),
  };
}

function buildProjectsExport(result) {
  const countsSummary = Object.entries(result.statusCounts || {}).map(([status, count]) => [
    t(`statuses.${status}`),
    count,
  ]);
  return {
    title: t('reports.projects'),
    filenameBase: 'تقرير-المشاريع',
    metadataRows: [[t('reports.totalProjects'), result.total || 0], ...countsSummary],
    columns: [
      { key: 'title', header: t('reports.projectTitle'), width: 34 },
      { key: 'college', header: t('auth.college'), width: 24 },
      { key: 'department', header: t('auth.department'), width: 24 },
      { key: 'field', header: t('projects.field'), width: 20 },
      { key: 'status', header: t('common.status'), width: 18 },
      { key: 'supervisor', header: t('showcase.supervisorLabel'), width: 24 },
      { key: 'progress', header: t('reports.meanCompletion'), width: 14 },
    ],
    rows: (result.items || []).map((p) => ({
      title: p.title || '',
      college: p.college?.name || '',
      department: p.department?.name || '',
      field: p.field ? t(`fields.${p.field}`) : '',
      status: p.status ? t(`statuses.${p.status}`) : '',
      supervisor: p.supervisor?.name || '—',
      progress: `${p.progress?.percent ?? 0}%`,
    })),
  };
}

function buildCompletionExport(raw) {
  const { current, comparison } = unwrapCompare(raw);
  const metadataRows = [
    [t('reports.meanCompletion'), `${formatNum(current.meanPercent)}%`],
    [t('reports.onTrackCount'), formatNum(current.counts?.on_track)],
    [t('reports.atRiskCount'), formatNum(current.counts?.at_risk)],
    [t('reports.delayedCount'), formatNum(current.counts?.delayed)],
  ];
  if (comparison) {
    metadataRows.push([
      `${t('reports.compareYearLabel')} — ${t('reports.meanCompletion')}`,
      `${formatNum(comparison.meanPercent)}%`,
    ]);
  }
  const rows =
    (current.perPhase || []).length > 0
      ? current.perPhase.map((ph) => ({
          name: ph.name,
          meanPercent: `${formatNum(ph.meanPercent)}%`,
          kind: t('reports.phaseName'),
        }))
      : (current.byChild || []).map((c) => ({
          name: c.name,
          meanPercent: `${formatNum(c.meanPercent)}%`,
          kind: t('reports.unitName'),
        }));

  return {
    title: t('reports.completion'),
    filenameBase: 'تقرير-معدلات-الإنجاز',
    metadataRows,
    columns: [
      { key: 'kind', header: t('common.details'), width: 18 },
      { key: 'name', header: t('reports.phaseName'), width: 32 },
      { key: 'meanPercent', header: t('reports.meanCompletion'), width: 18 },
    ],
    rows,
  };
}

function buildSupervisorsExport(raw) {
  const { current, comparison } = unwrapCompare(raw);
  const metadataRows = [
    [t('reports.unassignedProjects'), current.unassigned?.count || 0],
  ];
  if (comparison) {
    metadataRows.push([
      `${t('reports.compareYearLabel')} — ${t('reports.unassignedProjects')}`,
      comparison.unassigned?.count || 0,
    ]);
  }
  const rows = (current.supervisors || []).map((s) => ({
    name: s.name,
    primary: s.primary,
    cap: s.cap,
    co: s.co,
    remaining: s.remaining,
    status: s.overCap ? t('reports.overCapBadge') : t('reports.withinCapBadge'),
  }));
  for (const p of current.unassigned?.projects || []) {
    rows.push({
      name: `${t('reports.unassignedProjects')}: ${p.title}`,
      primary: 0,
      cap: 0,
      co: 0,
      remaining: 0,
      status: p.collegeName || '',
    });
  }
  return {
    title: t('reports.supervisors'),
    filenameBase: 'تقرير-توزيع-المشرفين',
    metadataRows,
    columns: [
      { key: 'name', header: t('reports.supervisorName'), width: 32 },
      { key: 'primary', header: t('reports.primaryCount'), width: 14 },
      { key: 'cap', header: t('reports.capacity'), width: 14 },
      { key: 'co', header: t('reports.coCount'), width: 14 },
      { key: 'remaining', header: t('reports.remainingCapacity'), width: 14 },
      { key: 'status', header: t('common.status'), width: 18 },
    ],
    rows,
  };
}

function buildEvaluationExport(raw) {
  const { current, comparison } = unwrapCompare(raw);
  const metadataRows = [
    [t('reports.studentsEvaluated'), formatNum(current.students)],
    [t('reports.meanGrade'), formatNum(current.mean)],
    [t('reports.minGrade'), formatNum(current.min)],
    [t('reports.maxGrade'), formatNum(current.max)],
    [t('reports.passCount'), formatNum(current.passCount)],
    [t('reports.failCount'), formatNum(current.failCount)],
    [t('reports.passRate'), `${formatNum(current.passRate)}%`],
  ];
  if (comparison) {
    metadataRows.push([
      `${t('reports.compareYearLabel')} — ${t('reports.meanGrade')}`,
      formatNum(comparison.mean),
    ]);
    metadataRows.push([
      `${t('reports.compareYearLabel')} — ${t('reports.passRate')}`,
      `${formatNum(comparison.passRate)}%`,
    ]);
  }
  const bands = current.bands || {};
  const rows = Object.entries(bands).map(([band, count]) => ({
    band: t(`gradeBands.${band}`),
    count,
  }));
  return {
    title: t('reports.evaluation'),
    filenameBase: 'تقرير-إحصائيات-التقييم',
    metadataRows,
    columns: [
      { key: 'band', header: t('evaluation.gradeBandLabel'), width: 28 },
      { key: 'count', header: t('reports.countLabel'), width: 18 },
    ],
    rows,
  };
}

function buildInsightsExport(raw) {
  const { current, comparison } = unwrapCompare(raw);
  const metadataRows = [
    [t('reports.totalBudget'), formatNum(current.budget?.total)],
    [t('reports.meanBudget'), formatNum(current.budget?.mean)],
    [t('reports.projectsWithBom'), formatNum(current.budget?.projectsWithBom)],
    [t('reports.lateCount'), formatNum(current.late?.count)],
    [t('reports.lateSubmissionRate'), `${formatNum(current.late?.percent)}%`],
    [t('reports.validVotes'), formatNum(current.engagement?.validVotes)],
    [t('reports.uniqueViews'), formatNum(current.engagement?.uniqueViews)],
    [t('reports.follows'), formatNum(current.engagement?.follows)],
    [t('reports.bookmarks'), formatNum(current.engagement?.bookmarks)],
  ];
  if (comparison) {
    metadataRows.push([
      `${t('reports.compareYearLabel')} — ${t('reports.totalBudget')}`,
      formatNum(comparison.budget?.total),
    ]);
  }
  const rows = [
    ...(current.byField || []).map((item) => ({
      category: t('reports.byFieldTitle'),
      name: item.isOther ? t('reports.otherCategory') : t(`fields.${item.name}`),
      count: item.count,
    })),
    ...(current.byTechnology || []).map((item) => ({
      category: t('reports.byTechnologyTitle'),
      name: item.isOther ? t('reports.otherCategory') : item.name,
      count: item.count,
    })),
  ];
  return {
    title: t('reports.insights'),
    filenameBase: 'تقرير-المؤشرات-والرؤى',
    metadataRows,
    columns: [
      { key: 'category', header: t('common.details'), width: 26 },
      { key: 'name', header: t('auth.name'), width: 28 },
      { key: 'count', header: t('reports.countLabel'), width: 16 },
    ],
    rows,
  };
}

function buildSupervisorSelfExport(result) {
  const allRows = [
    ...(result.primaryProjects || []).map((p) => ({ ...p, role: t('reports.primaryCount') })),
    ...(result.coSupervisedProjects || []).map((p) => ({ ...p, role: t('reports.coCount') })),
    ...(result.mentoredProjects || []).map((p) => ({ ...p, role: t('reports.mentoring') })),
  ];
  return {
    title: t('reports.supervisorDashboard'),
    filenameBase: 'تقرير-المشرف',
    metadataRows: [
      [t('reports.totalSupervised'), result.summary?.totalProjects || 0],
      [t('reports.meanCompletion'), `${formatNum(result.summary?.meanProgress)}%`],
    ],
    columns: [
      { key: 'title', header: t('reports.projectTitle'), width: 32 },
      { key: 'role', header: t('roles.supervisor'), width: 20 },
      { key: 'progressPercent', header: t('reports.meanCompletion'), width: 16 },
      { key: 'statusFlag', header: t('common.status'), width: 18 },
    ],
    rows: allRows.map((row) => ({
      title: row.title,
      role: row.role,
      progressPercent: `${formatNum(row.progressPercent)}%`,
      statusFlag: t(`statuses.${row.statusFlag}`),
    })),
  };
}

const REPORT_BUILDERS = {
  dashboard: buildDashboardExport,
  projects: buildProjectsExport,
  completion: buildCompletionExport,
  'supervisor-distribution': buildSupervisorsExport,
  evaluation: buildEvaluationExport,
  insights: buildInsightsExport,
  'supervisor-me': buildSupervisorSelfExport,
};

export async function sendReportExport({ reportKind, result, format, res }) {
  const builder = REPORT_BUILDERS[reportKind];
  const spec = builder(result);

  if (format === 'xlsx') {
    const workbook = createRtlWorkbook({
      sheetName: spec.title.slice(0, 31),
      metadataRows: spec.metadataRows,
      columns: spec.columns,
      rows: spec.rows,
    });
    await sendExcelResponse(res, workbook, `${spec.filenameBase}.xlsx`);
    return;
  }

  const doc = createArabicPdf({
    title: spec.title,
    subtitle: `${t('common.universityName')} — ${t('reports.reportGeneratedAt')}: ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date())}`,
    layout: spec.columns.length > 5 ? 'landscape' : 'portrait',
  });

  if (spec.metadataRows.length > 0) {
    doc.y = drawRtlTable(doc, {
      columns: [
        { key: 'metric', header: t('reports.summarySection'), width: 240 },
        { key: 'value', header: t('reports.countLabel'), width: 160 },
      ],
      rows: spec.metadataRows.map(([metric, value]) => ({
        metric: String(metric),
        value: String(value),
      })),
      startY: doc.y,
    });
    doc.y += 14;
  }

  if (doc.y > doc.page.height - 140) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  doc.font('Cairo-Bold').fontSize(12).fillColor('#122f4a');
  doc.y = drawRtlText(doc, t('reports.detailsSection'), doc.page.margins.left, doc.y) + 6;
  drawRtlTable(doc, {
    columns: spec.columns.map((c) => ({ key: c.key, header: c.header, width: (c.width || 20) * 6 })),
    rows: spec.rows,
    startY: doc.y,
  });

  sendPdfResponse(res, doc, `${spec.filenameBase}.pdf`);
}
