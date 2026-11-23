import mongoose from 'mongoose';
import {
  CONTACT_REQUEST_STATES,
  DEFAULT_SUPERVISOR_PRIMARY_CAP,
  GRADE_BANDS,
  PROPOSAL_STATUSES,
  REPORT_EXPORT_MAX_PDF,
  REPORT_EXPORT_MAX_XLSX,
  STATUS_FLAGS,
  USER_STATUSES,
} from '@spp/shared/constants';
import {
  findUsersBasicByIds,
  listActiveSupervisorsForReports,
} from '../auth/index.js';
import { aggregateGrades } from '../evaluation/index.js';
import { listReportOrgEntities } from '../organization/index.js';
import {
  aggregateProjects,
  findAndCountReportProjects,
  findSupervisedProjectsForReport,
} from '../projects/index.js';
import {
  aggregateContactRequests,
  aggregatePageViews,
} from '../showcase/index.js';
import {
  aggregateProjectPhases,
  aggregateSubmissions,
  aggregateToolItems,
} from '../tracking/index.js';
import {
  isAdminCaller,
  isCacheableQuery,
  mergeMatch,
  resolveReportContext,
  resolveYearCriteria,
  round2,
  toObjectId,
  withStatsCache,
} from './reportsScope.js';
import StatsCache from './statsCache.model.js';

const APPROVED_OR_ARCHIVED = [PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED];
const TOP_BUCKET_LIMIT = 25;
const ATLAS_M0_LIMIT_MB = 512;
const ATLAS_M0_WARNING_MB = 350;
const ATLAS_M0_CRITICAL_MB = 440;
const BYTES_PER_MB = 1024 * 1024;

export async function getAtlasStorageUsage() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return null;
  }
  const stats = await mongoose.connection.db.stats({ scale: 1 });
  const dataSizeBytes = Number(stats.dataSize || 0);
  const indexSizeBytes = Number(stats.indexSize || 0);
  const usedMb = round2((dataSizeBytes + indexSizeBytes) / BYTES_PER_MB);
  const percent = round2(Math.min(100, (usedMb / ATLAS_M0_LIMIT_MB) * 100));
  const level =
    usedMb >= ATLAS_M0_CRITICAL_MB
      ? 'critical'
      : usedMb >= ATLAS_M0_WARNING_MB
        ? 'warning'
        : 'normal';

  return {
    dataSizeMb: round2(dataSizeBytes / BYTES_PER_MB),
    indexSizeMb: round2(indexSizeBytes / BYTES_PER_MB),
    usedMb,
    limitMb: ATLAS_M0_LIMIT_MB,
    warningMb: ATLAS_M0_WARNING_MB,
    criticalMb: ATLAS_M0_CRITICAL_MB,
    percent,
    level,
    collections: Number(stats.collections || 0),
    objects: Number(stats.objects || 0),
  };
}

function initFlagCounts() {
  return {
    [STATUS_FLAGS.ON_TRACK]: 0,
    [STATUS_FLAGS.AT_RISK]: 0,
    [STATUS_FLAGS.DELAYED]: 0,
  };
}

function initBandCounts() {
  return {
    [GRADE_BANDS.EXCELLENT]: 0,
    [GRADE_BANDS.VERY_GOOD]: 0,
    [GRADE_BANDS.GOOD]: 0,
    [GRADE_BANDS.ACCEPTABLE]: 0,
    [GRADE_BANDS.FAIL]: 0,
  };
}

function buildFlagShares(counts, total) {
  if (total <= 0) return { on_track: 0, at_risk: 0, delayed: 0 };
  return {
    on_track: round2((counts.on_track / total) * 100),
    at_risk: round2((counts.at_risk / total) * 100),
    delayed: round2((counts.delayed / total) * 100),
  };
}

function resolveFreshFlag(query, user) {
  return query.fresh === 'true' && isAdminCaller(user);
}

async function runWithCompare({ ctx, query, kind, fresh, computeOne }) {
  const currentYear = resolveYearCriteria({
    academicYearId: query.academicYearId,
    yearLabel: query.yearLabel,
    academicYearMap: ctx.academicYearMap,
  });
  const useCache = isCacheableQuery(query, ctx.scopeType);

  const current = await withStatsCache({
    kind,
    yearKey: currentYear.yearKey,
    scopeType: ctx.scopeType,
    scopeId: ctx.scopeId,
    useCache,
    fresh,
    computeFn: () => computeOne(currentYear),
  });

  if (!query.compareYearId && !query.compareYearLabel) {
    return current;
  }

  const compareYear = resolveYearCriteria({
    academicYearId: query.compareYearId,
    yearLabel: query.compareYearLabel,
    academicYearMap: ctx.academicYearMap,
  });
  const comparison = await withStatsCache({
    kind,
    yearKey: compareYear.yearKey,
    scopeType: ctx.scopeType,
    scopeId: ctx.scopeId,
    useCache,
    fresh,
    computeFn: () => computeOne(compareYear),
  });

  return { current, comparison };
}

function filterDashboardEntities(ctx) {
  const colleges = ctx.allowed.collegeIds
    ? ctx.colleges.filter((c) => ctx.allowed.collegeIds.has(String(c._id)))
    : ctx.colleges;
  const departments = ctx.allowed.departmentIds
    ? ctx.departments.filter((d) => ctx.allowed.departmentIds.has(String(d._id)))
    : ctx.scopeType === 'college' && ctx.scopeId
      ? ctx.departments.filter((d) => String(d.collegeId) === String(ctx.scopeId))
      : ctx.departments;
  return { colleges, departments };
}

export async function getDashboardReport({ scopeFilter, query }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const year = resolveYearCriteria({
    academicYearId: query.academicYearId,
    yearLabel: query.yearLabel,
    academicYearMap: ctx.academicYearMap,
  });
  const match = mergeMatch(ctx.baseScopeMatch, year.yearMatch);

  const [projectGroups, gradeStats, projectDocs] = await Promise.all([
    aggregateProjects([
      { $match: match },
      {
        $group: {
          _id: {
            collegeId: '$collegeId',
            departmentId: '$departmentId',
            status: '$status',
            statusFlag: '$statusFlag',
          },
          count: { $sum: 1 },
          progressSum: { $sum: { $ifNull: ['$progress.percent', 0] } },
        },
      },
    ]),
    aggregateGrades([
      { $match: mergeMatch(match, { locked: true, isLatest: true }) },
      {
        $group: {
          _id: null,
          students: { $sum: 1 },
          passCount: { $sum: { $cond: ['$passed', 1, 0] } },
          finalSum: { $sum: '$final' },
        },
      },
    ]),
    ['department', 'supervisor'].includes(ctx.scopeType)
      ? aggregateProjects([
          { $match: match },
          { $sort: { updatedAt: -1 } },
          { $limit: 100 },
          {
            $project: {
              _id: 1,
              title: 1,
              slug: 1,
              status: 1,
              statusFlag: 1,
              progressPercent: { $ifNull: ['$progress.percent', 0] },
            },
          },
        ])
      : Promise.resolve([]),
  ]);

  let totalProjects = 0;
  let approvedProjects = 0;
  let approvedProgressSum = 0;
  let delayedProjects = 0;
  const byCollege = new Map();
  const byDepartment = new Map();

  const addBucket = (map, key, row) => {
    const id = String(key);
    const cur = map.get(id) || {
      totalProjects: 0,
      approvedProjects: 0,
      progressSum: 0,
      delayedProjects: 0,
    };
    cur.totalProjects += row.count;
    if (APPROVED_OR_ARCHIVED.includes(row._id.status)) {
      cur.approvedProjects += row.count;
      cur.progressSum += row.progressSum;
      if (row._id.statusFlag === STATUS_FLAGS.DELAYED) {
        cur.delayedProjects += row.count;
      }
    }
    map.set(id, cur);
  };

  for (const row of projectGroups) {
    totalProjects += row.count;
    if (APPROVED_OR_ARCHIVED.includes(row._id.status)) {
      approvedProjects += row.count;
      approvedProgressSum += row.progressSum;
      if (row._id.statusFlag === STATUS_FLAGS.DELAYED) delayedProjects += row.count;
    }
    if (row._id.collegeId) addBucket(byCollege, row._id.collegeId, row);
    if (row._id.departmentId) addBucket(byDepartment, row._id.departmentId, row);
  }

  const g = gradeStats[0] || { students: 0, passCount: 0, finalSum: 0 };
  const kpis = {
    totalProjects,
    approvedProjects,
    meanCompletion: approvedProjects > 0 ? round2(approvedProgressSum / approvedProjects) : 0,
    delayedProjects,
    studentsEvaluated: g.students,
    meanGrade: g.students > 0 ? round2(g.finalSum / g.students) : 0,
    passRate: g.students > 0 ? round2((g.passCount / g.students) * 100) : 0,
  };

  const { colleges, departments } = filterDashboardEntities(ctx);
  let children = [];
  if (ctx.scopeType === 'university') {
    children = colleges.map((c) => {
      const s = byCollege.get(String(c._id)) || {
        totalProjects: 0,
        approvedProjects: 0,
        progressSum: 0,
        delayedProjects: 0,
      };
      return {
        scopeType: 'college',
        id: String(c._id),
        name: c.name,
        status: c.status,
        kpis: {
          totalProjects: s.totalProjects,
          approvedProjects: s.approvedProjects,
          meanCompletion:
            s.approvedProjects > 0 ? round2(s.progressSum / s.approvedProjects) : 0,
          delayedProjects: s.delayedProjects,
        },
      };
    });
  } else if (ctx.scopeType === 'college') {
    children = departments.map((d) => {
      const s = byDepartment.get(String(d._id)) || {
        totalProjects: 0,
        approvedProjects: 0,
        progressSum: 0,
        delayedProjects: 0,
      };
      return {
        scopeType: 'department',
        id: String(d._id),
        name: d.name,
        status: d.status,
        kpis: {
          totalProjects: s.totalProjects,
          approvedProjects: s.approvedProjects,
          meanCompletion:
            s.approvedProjects > 0 ? round2(s.progressSum / s.approvedProjects) : 0,
          delayedProjects: s.delayedProjects,
        },
      };
    });
  } else {
    children = projectDocs.map((p) => ({
      scopeType: 'project',
      id: String(p._id),
      name: p.title,
      status: p.status,
      kpis: {
        progressPercent: round2(p.progressPercent),
        statusFlag: p.statusFlag || STATUS_FLAGS.ON_TRACK,
      },
    }));
  }

  const storageUsage =
    ctx.allowed.isUniversity && ctx.scopeType === 'university'
      ? await getAtlasStorageUsage()
      : undefined;

  return {
    scopeType: ctx.scopeType,
    scopeId: ctx.scopeId ? String(ctx.scopeId) : null,
    yearKey: year.yearKey,
    yearLabel: year.label,
    kpis,
    children,
    ...(storageUsage ? { storageUsage } : {}),
    computedAt: new Date(),
  };
}

export async function getProjectsReport({ scopeFilter, query, pagination }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const year = resolveYearCriteria({
    academicYearId: query.academicYearId,
    yearLabel: query.yearLabel,
    academicYearMap: ctx.academicYearMap,
  });

  const baseFilters = {};
  if (query.field) baseFilters.field = query.field;

  const statusMatch = mergeMatch(mergeMatch(ctx.baseScopeMatch, year.yearMatch), baseFilters);
  const fullMatch = query.status
    ? mergeMatch(statusMatch, { status: query.status })
    : statusMatch;

  const isExport = query.format === 'xlsx' || query.format === 'pdf';
  const maxExport =
    query.format === 'xlsx' ? REPORT_EXPORT_MAX_XLSX : REPORT_EXPORT_MAX_PDF;
  const effectiveSkip = isExport ? 0 : pagination.skip;
  const effectiveLimit = isExport ? maxExport : pagination.limit;

  const [{ items, total }, statusBuckets] = await Promise.all([
    findAndCountReportProjects({
      match: fullMatch,
      sort: pagination.sort,
      skip: effectiveSkip,
      limit: effectiveLimit,
    }),
    aggregateProjects([
      { $match: statusMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = {};
  for (const row of statusBuckets) {
    statusCounts[row._id] = row.count;
  }

  return {
    items,
    page: isExport ? 1 : pagination.page,
    limit: effectiveLimit,
    total,
    pages: isExport ? 1 : total === 0 ? 0 : Math.ceil(total / pagination.limit),
    statusCounts,
  };
}

async function computeCompletionMetrics({ ctx, year }) {
  const match = mergeMatch(
    mergeMatch(ctx.baseScopeMatch, year.yearMatch),
    { status: mongoose.trusted({ $in: APPROVED_OR_ARCHIVED }) }
  );

  const projects = await aggregateProjects([
    { $match: match },
    {
      $project: {
        _id: 1,
        collegeId: 1,
        departmentId: 1,
        statusFlag: 1,
        progress: 1,
      },
    },
  ]);

  const projectIds = projects.map((p) => p._id);
  const phases =
    projectIds.length > 0
      ? await aggregateProjectPhases([
          { $match: { projectId: mongoose.trusted({ $in: projectIds }) } },
          {
            $project: {
              _id: 1,
              projectId: 1,
              order: 1,
              name: 1,
              completedBySupervisor: 1,
            },
          },
        ])
      : [];

  const counts = initFlagCounts();
  let percentSum = 0;
  const projectPhasePercentMap = new Map();
  const childAccum = new Map();

  for (const proj of projects) {
    const pct = Number(proj.progress?.percent || 0);
    percentSum += pct;
    const flag = proj.statusFlag || STATUS_FLAGS.ON_TRACK;
    if (Object.hasOwn(counts, flag)) counts[flag] += 1;

    const perPhaseMap = new Map();
    for (const entry of proj.progress?.perPhase || []) {
      perPhaseMap.set(String(entry.phaseId), Number(entry.percent || 0));
    }
    projectPhasePercentMap.set(String(proj._id), perPhaseMap);

    const childKey =
      ctx.scopeType === 'university'
        ? String(proj.collegeId)
        : ctx.scopeType === 'college'
          ? String(proj.departmentId)
          : null;
    if (childKey) {
      const acc = childAccum.get(childKey) || {
        count: 0,
        sum: 0,
        counts: initFlagCounts(),
      };
      acc.count += 1;
      acc.sum += pct;
      if (Object.hasOwn(acc.counts, flag)) acc.counts[flag] += 1;
      childAccum.set(childKey, acc);
    }
  }

  const phaseGroups = new Map();
  for (const phase of phases) {
    const perPhaseMap = projectPhasePercentMap.get(String(phase.projectId));
    const pct = perPhaseMap?.has(String(phase._id))
      ? perPhaseMap.get(String(phase._id))
      : phase.completedBySupervisor?.at
        ? 100
        : 0;
    const groupKey = ctx.scopeType === 'university' ? String(phase.order) : `${phase.order}:${phase.name}`;
    const existing = phaseGroups.get(groupKey) || {
      order: phase.order,
      name: phase.name,
      sum: 0,
      count: 0,
    };
    existing.sum += pct;
    existing.count += 1;
    phaseGroups.set(groupKey, existing);
  }

  const perPhase = [...phaseGroups.values()]
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      order: entry.order,
      name: entry.name,
      meanPercent: entry.count > 0 ? round2(entry.sum / entry.count) : 0,
    }));

  const { colleges, departments } = filterDashboardEntities(ctx);
  const childEntities =
    ctx.scopeType === 'university'
      ? colleges
      : ctx.scopeType === 'college'
        ? departments
        : [];
  const byChild = childEntities.map((entity) => {
    const acc = childAccum.get(String(entity._id)) || {
      count: 0,
      sum: 0,
      counts: initFlagCounts(),
    };
    return {
      id: String(entity._id),
      name: entity.name,
      status: entity.status,
      projectCount: acc.count,
      meanPercent: acc.count > 0 ? round2(acc.sum / acc.count) : 0,
      counts: acc.counts,
    };
  });

  const total = projects.length;
  return {
    meanPercent: total > 0 ? round2(percentSum / total) : 0,
    totalProjects: total,
    counts,
    shares: buildFlagShares(counts, total),
    perPhase,
    byChild,
  };
}

export async function getCompletionReport({ scopeFilter, query, user }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const fresh = resolveFreshFlag(query, user);
  return runWithCompare({
    ctx,
    query,
    kind: 'completion',
    fresh,
    computeOne: (year) => computeCompletionMetrics({ ctx, year }),
  });
}

async function computeSupervisorDistribution({ ctx, year }) {
  const match = mergeMatch(
    mergeMatch(ctx.baseScopeMatch, year.yearMatch),
    { status: PROPOSAL_STATUSES.APPROVED }
  );

  const collegeIds = ctx.scopeId && ctx.scopeType === 'college'
    ? [String(ctx.scopeId)]
    : ctx.allowed.collegeIds
      ? [...ctx.allowed.collegeIds]
      : [];
  const departmentIds = ctx.scopeId && ctx.scopeType === 'department'
    ? [String(ctx.scopeId)]
    : ctx.allowed.departmentIds
      ? [...ctx.allowed.departmentIds]
      : [];

  const [projects, activeSupervisors] = await Promise.all([
    aggregateProjects([
      { $match: match },
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          collegeId: 1,
          departmentId: 1,
          supervision: 1,
        },
      },
    ]),
    listActiveSupervisorsForReports({ collegeIds, departmentIds }),
  ]);

  const supIdsFromProjects = new Set();
  for (const p of projects) {
    if (p.supervision?.primaryId) supIdsFromProjects.add(String(p.supervision.primaryId));
    for (const coId of p.supervision?.coSupervisorIds || []) supIdsFromProjects.add(String(coId));
  }
  const userMap = await findUsersBasicByIds([...supIdsFromProjects]);

  const supervisorBuckets = new Map();
  for (const sup of activeSupervisors) {
    const collegeCap =
      ctx.collegeMap.get(String(sup.collegeId))?.settings?.supervisorPrimaryCap ||
      DEFAULT_SUPERVISOR_PRIMARY_CAP;
    supervisorBuckets.set(sup.id, {
      id: sup.id,
      name: sup.name,
      status: sup.status,
      collegeId: sup.collegeId,
      cap: collegeCap,
      primary: 0,
      co: 0,
    });
  }

  const ensureActiveBucket = (supId, projectCollegeId) => {
    const id = String(supId);
    if (supervisorBuckets.has(id)) return supervisorBuckets.get(id);
    const user = userMap.get(id);
    if (!user || user.status !== USER_STATUSES.ACTIVE) return null;
    const cap =
      ctx.collegeMap.get(String(user.collegeId || projectCollegeId))?.settings
        ?.supervisorPrimaryCap || DEFAULT_SUPERVISOR_PRIMARY_CAP;
    const entry = {
      id,
      name: user.name,
      status: user.status,
      collegeId: user.collegeId ? String(user.collegeId) : String(projectCollegeId),
      cap,
      primary: 0,
      co: 0,
    };
    supervisorBuckets.set(id, entry);
    return entry;
  };

  const unassignedProjects = [];
  for (const p of projects) {
    const primaryId = p.supervision?.primaryId ? String(p.supervision.primaryId) : null;
    const primaryUser = primaryId ? userMap.get(primaryId) : null;
    const isPrimaryActive = Boolean(primaryUser && primaryUser.status === USER_STATUSES.ACTIVE);

    if (!primaryId || !isPrimaryActive) {
      unassignedProjects.push({
        id: String(p._id),
        title: p.title,
        slug: p.slug,
        collegeId: String(p.collegeId),
        collegeName: ctx.collegeMap.get(String(p.collegeId))?.name || '',
        departmentId: String(p.departmentId),
        departmentName: ctx.departmentMap.get(String(p.departmentId))?.name || '',
      });
    } else {
      const bucket = ensureActiveBucket(primaryId, p.collegeId);
      if (bucket) bucket.primary += 1;
    }

    for (const coId of p.supervision?.coSupervisorIds || []) {
      const coBucket = ensureActiveBucket(coId, p.collegeId);
      if (coBucket) coBucket.co += 1;
    }
  }

  const supervisors = [...supervisorBuckets.values()]
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      primary: s.primary,
      cap: s.cap,
      co: s.co,
      remaining: Math.max(0, s.cap - s.primary),
      overCap: s.primary > s.cap,
    }))
    .sort((a, b) => b.primary - a.primary || a.name.localeCompare(b.name, 'ar'));

  return {
    supervisors,
    unassigned: {
      count: unassignedProjects.length,
      projects: unassignedProjects.slice(0, 100),
    },
  };
}

export async function getSupervisorDistributionReport({ scopeFilter, query, user }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const fresh = resolveFreshFlag(query, user);
  return runWithCompare({
    ctx,
    query,
    kind: 'supervisor_load',
    fresh,
    computeOne: (year) => computeSupervisorDistribution({ ctx, year }),
  });
}

async function computeEvaluationStats({ ctx, year }) {
  const match = mergeMatch(
    mergeMatch(ctx.baseScopeMatch, year.yearMatch),
    { locked: true, isLatest: true }
  );

  const [overallAgg, bandAgg, childAgg] = await Promise.all([
    aggregateGrades([
      { $match: match },
      {
        $group: {
          _id: null,
          students: { $sum: 1 },
          mean: { $avg: '$final' },
          min: { $min: '$final' },
          max: { $max: '$final' },
          passCount: { $sum: { $cond: ['$passed', 1, 0] } },
          failCount: { $sum: { $cond: ['$passed', 0, 1] } },
        },
      },
    ]),
    aggregateGrades([
      { $match: match },
      { $group: { _id: '$band', count: { $sum: 1 } } },
    ]),
    ctx.scopeType === 'university' || ctx.scopeType === 'college'
      ? aggregateGrades([
          { $match: match },
          {
            $group: {
              _id: ctx.scopeType === 'university' ? '$collegeId' : '$departmentId',
              students: { $sum: 1 },
              mean: { $avg: '$final' },
              min: { $min: '$final' },
              max: { $max: '$final' },
              passCount: { $sum: { $cond: ['$passed', 1, 0] } },
              failCount: { $sum: { $cond: ['$passed', 0, 1] } },
            },
          },
        ])
      : Promise.resolve([]),
  ]);

  const bands = initBandCounts();
  for (const b of bandAgg) {
    if (Object.hasOwn(bands, b._id)) bands[b._id] = b.count;
  }

  const overall = overallAgg[0] || {
    students: 0,
    mean: 0,
    min: 0,
    max: 0,
    passCount: 0,
    failCount: 0,
  };

  const { colleges, departments } = filterDashboardEntities(ctx);
  const childMap = new Map(childAgg.map((row) => [String(row._id), row]));
  const childEntities =
    ctx.scopeType === 'university'
      ? colleges
      : ctx.scopeType === 'college'
        ? departments
        : [];

  const byChild = childEntities.map((entity) => {
    const row = childMap.get(String(entity._id)) || {
      students: 0,
      mean: 0,
      min: 0,
      max: 0,
      passCount: 0,
      failCount: 0,
    };
    return {
      id: String(entity._id),
      name: entity.name,
      status: entity.status,
      students: row.students,
      mean: row.students > 0 ? round2(row.mean) : 0,
      min: row.students > 0 ? round2(row.min) : 0,
      max: row.students > 0 ? round2(row.max) : 0,
      passCount: row.passCount,
      failCount: row.failCount,
      passRate: row.students > 0 ? round2((row.passCount / row.students) * 100) : 0,
    };
  });

  return {
    students: overall.students,
    mean: overall.students > 0 ? round2(overall.mean) : 0,
    min: overall.students > 0 ? round2(overall.min) : 0,
    max: overall.students > 0 ? round2(overall.max) : 0,
    passCount: overall.passCount,
    failCount: overall.failCount,
    passRate:
      overall.students > 0 ? round2((overall.passCount / overall.students) * 100) : 0,
    bands,
    byChild,
  };
}

export async function getEvaluationReport({ scopeFilter, query, user }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const fresh = resolveFreshFlag(query, user);
  return runWithCompare({
    ctx,
    query,
    kind: 'evaluation',
    fresh,
    computeOne: (year) => computeEvaluationStats({ ctx, year }),
  });
}

function collapseTopBuckets(entries) {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  if (sorted.length <= TOP_BUCKET_LIMIT) return sorted;
  const top = sorted.slice(0, TOP_BUCKET_LIMIT);
  const otherCount = sorted.slice(TOP_BUCKET_LIMIT).reduce((sum, item) => sum + item.count, 0);
  return [...top, { name: 'other', count: otherCount, isOther: true }];
}

async function computeInsights({ ctx, year }) {
  const match = mergeMatch(
    mergeMatch(ctx.baseScopeMatch, year.yearMatch),
    { status: mongoose.trusted({ $in: APPROVED_OR_ARCHIVED }) }
  );

  const projects = await aggregateProjects([
    { $match: match },
    {
      $project: {
        _id: 1,
        field: 1,
        budgetEstimate: 1,
        isPublished: 1,
        showcaseStats: 1,
      },
    },
  ]);

  const projectIds = projects.map((p) => p._id);
  const publishedProjects = projects.filter((p) => p.isPublished);
  const publishedIds = publishedProjects.map((p) => p._id);

  const fieldCounts = new Map();
  let budgetTotal = 0;
  let projectsWithBom = 0;
  let validVotes = 0;
  let views7dSum = 0;
  let follows = 0;
  let bookmarks = 0;

  for (const p of projects) {
    fieldCounts.set(p.field, (fieldCounts.get(p.field) || 0) + 1);
    const est = Number(p.budgetEstimate || 0);
    if (est > 0) {
      budgetTotal += est;
      projectsWithBom += 1;
    }
    if (p.isPublished) {
      validVotes += Number(p.showcaseStats?.validVotes || 0);
      views7dSum += Number(p.showcaseStats?.views7d || 0);
      follows += Number(p.showcaseStats?.follows || 0);
      bookmarks += Number(p.showcaseStats?.bookmarks || 0);
    }
  }

  const [toolAgg, submissionAgg, pageViewAgg, contactAgg] = await Promise.all([
    projectIds.length > 0
      ? aggregateToolItems([
          { $match: { projectId: mongoose.trusted({ $in: projectIds }) } },
          { $group: { _id: '$name', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    projectIds.length > 0
      ? aggregateSubmissions([
          { $match: { projectId: mongoose.trusted({ $in: projectIds }), isLatest: true } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              lateCount: { $sum: { $cond: ['$isLate', 1, 0] } },
            },
          },
        ])
      : Promise.resolve([]),
    publishedIds.length > 0
      ? aggregatePageViews([
          { $match: { projectId: mongoose.trusted({ $in: publishedIds }) } },
          { $count: 'count' },
        ])
      : Promise.resolve([]),
    publishedIds.length > 0
      ? aggregateContactRequests([
          { $match: { projectId: mongoose.trusted({ $in: publishedIds }) } },
          { $group: { _id: '$state', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const sub = submissionAgg[0] || { total: 0, lateCount: 0 };
  const contactRequestsByStatus = {
    [CONTACT_REQUEST_STATES.PENDING]: 0,
    [CONTACT_REQUEST_STATES.ACCEPTED]: 0,
    [CONTACT_REQUEST_STATES.DECLINED]: 0,
    [CONTACT_REQUEST_STATES.WITHDRAWN]: 0,
  };
  for (const row of contactAgg) {
    if (Object.hasOwn(contactRequestsByStatus, row._id)) {
      contactRequestsByStatus[row._id] = row.count;
    }
  }

  const pageViewCount = pageViewAgg[0]?.count || 0;

  return {
    byField: collapseTopBuckets(
      [...fieldCounts.entries()].map(([name, count]) => ({ name, count }))
    ),
    byTechnology: collapseTopBuckets(
      toolAgg.map((row) => ({ name: row._id, count: row.count }))
    ),
    budget: {
      total: round2(budgetTotal),
      mean: projectsWithBom > 0 ? round2(budgetTotal / projectsWithBom) : 0,
      projectsWithBom,
    },
    late: {
      count: sub.lateCount,
      percent: sub.total > 0 ? round2((sub.lateCount / sub.total) * 100) : 0,
    },
    engagement: {
      validVotes,
      uniqueViews: Math.max(pageViewCount, views7dSum),
      follows,
      bookmarks,
      contactRequestsByStatus,
    },
  };
}

export async function getInsightsReport({ scopeFilter, query, user }) {
  const ctx = await resolveReportContext({ scopeFilter, query });
  const fresh = resolveFreshFlag(query, user);
  return runWithCompare({
    ctx,
    query,
    kind: 'insights',
    fresh,
    computeOne: (year) => computeInsights({ ctx, year }),
  });
}

export async function getSupervisorSelfReport({ user, query }) {
  const yearMatch = {};
  if (query.academicYearId) yearMatch.academicYearId = toObjectId(query.academicYearId);
  else if (query.yearLabel) yearMatch.academicYearLabel = query.yearLabel;

  const projects = await findSupervisedProjectsForReport(toObjectId(user.id), yearMatch);
  const uid = String(user.id);

  const primaryProjects = [];
  const coSupervisedProjects = [];
  const mentoredProjects = [];
  const countsByFlag = initFlagCounts();
  let progressSum = 0;

  const toRow = (p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    progressPercent: round2(p.progress?.percent || 0),
    statusFlag: p.statusFlag || STATUS_FLAGS.ON_TRACK,
    college: p.college,
    department: p.department,
    academicYearLabel: p.academicYearLabel,
  });

  for (const p of projects) {
    const row = toRow(p);
    progressSum += row.progressPercent;
    if (Object.hasOwn(countsByFlag, row.statusFlag)) {
      countsByFlag[row.statusFlag] += 1;
    }
    if (String(p.supervision?.primaryId || '') === uid) {
      primaryProjects.push(row);
    } else if ((p.supervision?.coSupervisorIds || []).map(String).includes(uid)) {
      coSupervisedProjects.push(row);
    } else if ((p.supervision?.mentorIds || []).map(String).includes(uid)) {
      mentoredProjects.push(row);
    }
  }

  return {
    primaryProjects,
    coSupervisedProjects,
    mentoredProjects,
    summary: {
      totalProjects: projects.length,
      primaryCount: primaryProjects.length,
      coCount: coSupervisedProjects.length,
      mentorCount: mentoredProjects.length,
      meanProgress: projects.length > 0 ? round2(progressSum / projects.length) : 0,
      countsByFlag,
    },
  };
}

export async function recalculateAllStatsCaches() {
  const { colleges, departments, academicYears } = await listReportOrgEntities();
  const collegeMap = new Map(colleges.map((c) => [String(c._id), c]));
  const departmentMap = new Map(departments.map((d) => [String(d._id), d]));
  const academicYearMap = new Map(academicYears.map((y) => [String(y._id), y]));

  const currentYearLabels = [...new Set(academicYears.filter((y) => y.isCurrent).map((y) => y.label))];
  let updated = 0;

  const refreshKinds = [
    ['completion', computeCompletionMetrics],
    ['supervisor_load', computeSupervisorDistribution],
    ['evaluation', computeEvaluationStats],
    ['insights', computeInsights],
  ];

  for (const label of currentYearLabels) {
    const ctx = {
      allowed: { isUniversity: true, collegeIds: null, departmentIds: null, supervisorIds: null },
      colleges,
      departments,
      academicYears,
      collegeMap,
      departmentMap,
      academicYearMap,
      scopeType: 'university',
      scopeId: null,
      baseScopeMatch: {},
    };
    const year = { yearKey: label, label, yearMatch: { academicYearLabel: label } };
    for (const [kind, fn] of refreshKinds) {
      await withStatsCache({
        kind,
        yearKey: year.yearKey,
        scopeType: 'university',
        scopeId: null,
        useCache: true,
        fresh: true,
        computeFn: () => fn({ ctx, year }),
      });
      updated += 1;
    }
  }

  for (const ay of academicYears.filter((y) => y.isCurrent)) {
    const cid = toObjectId(ay.collegeId);
    const ctx = {
      allowed: { isUniversity: false, collegeIds: new Set([String(cid)]), departmentIds: null, supervisorIds: null },
      colleges,
      departments,
      academicYears,
      collegeMap,
      departmentMap,
      academicYearMap,
      scopeType: 'college',
      scopeId: cid,
      baseScopeMatch: { collegeId: cid },
    };
    const year = { yearKey: String(ay._id), label: ay.label, yearMatch: { academicYearId: ay._id } };
    for (const [kind, fn] of refreshKinds) {
      await withStatsCache({
        kind,
        yearKey: year.yearKey,
        scopeType: 'college',
        scopeId: cid,
        useCache: true,
        fresh: true,
        computeFn: () => fn({ ctx, year }),
      });
      updated += 1;
    }
  }

  return { updated };
}

export async function purgeExpiredStatsCaches(cutoffDate) {
  const res = await StatsCache.deleteMany({
    computedAt: mongoose.trusted({ $lt: cutoffDate }),
  });
  return res.deletedCount || 0;
}
