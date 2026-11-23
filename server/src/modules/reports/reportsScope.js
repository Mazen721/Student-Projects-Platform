import mongoose from 'mongoose';
import { ROLES } from '@spp/shared/constants';
import { AppError } from '../../core/errors/AppError.js';
import { listReportOrgEntities } from '../organization/index.js';
import StatsCache from './statsCache.model.js';

const CACHE_TTL_MS = 15 * 60 * 1000;
const OBJECT_ID_FIELDS = new Set([
  'collegeId',
  'departmentId',
  'academicYearId',
  'supervisorIds',
  '_id',
]);

export function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

export function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function convertFilterToObjectIds(filter = {}) {
  if (!filter || typeof filter !== 'object') return {};
  if (Array.isArray(filter.$or)) {
    return { $or: filter.$or.map((clause) => convertFilterToObjectIds(clause)) };
  }
  const out = {};
  for (const [key, val] of Object.entries(filter)) {
    if (val === null) {
      out[key] = null;
    } else if (OBJECT_ID_FIELDS.has(key) && typeof val === 'string') {
      out[key] = toObjectId(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export function extractAllowedScope(scopeFilter = {}) {
  if (scopeFilter._id === null) {
    throw AppError.notFound();
  }
  const keys = Object.keys(scopeFilter);
  if (keys.length === 0) {
    return { isUniversity: true, collegeIds: null, departmentIds: null, supervisorIds: null };
  }
  const clauses = Array.isArray(scopeFilter.$or) ? scopeFilter.$or : [scopeFilter];
  const collegeIds = new Set();
  const departmentIds = new Set();
  const supervisorIds = new Set();

  for (const clause of clauses) {
    if (clause.collegeId) collegeIds.add(String(clause.collegeId));
    if (clause.departmentId) departmentIds.add(String(clause.departmentId));
    if (clause.supervisorIds) supervisorIds.add(String(clause.supervisorIds));
  }

  return {
    isUniversity: false,
    collegeIds: collegeIds.size > 0 ? collegeIds : null,
    departmentIds: departmentIds.size > 0 ? departmentIds : null,
    supervisorIds: supervisorIds.size > 0 ? supervisorIds : null,
  };
}

export function assertQueryWithinScope({ allowed, query, departmentMap, academicYearMap }) {
  if (allowed.isUniversity) return;

  if (query.academicYearId) {
    const ay = academicYearMap.get(String(query.academicYearId));
    if (!ay) throw AppError.notFound();
    if (allowed.collegeIds && !allowed.collegeIds.has(String(ay.collegeId))) {
      throw AppError.notFound();
    }
    if (allowed.departmentIds) {
      const hasDeptInCollege = [...allowed.departmentIds].some(
        (deptId) => String(departmentMap.get(deptId)?.collegeId) === String(ay.collegeId)
      );
      if (!hasDeptInCollege) throw AppError.notFound();
    }
  }

  if (query.collegeId) {
    if (allowed.collegeIds && !allowed.collegeIds.has(String(query.collegeId))) {
      throw AppError.notFound();
    }
    if (allowed.departmentIds && !allowed.collegeIds) {
      const hasDeptInCollege = [...allowed.departmentIds].some(
        (deptId) => String(departmentMap.get(deptId)?.collegeId) === String(query.collegeId)
      );
      if (!hasDeptInCollege) throw AppError.notFound();
    }
    if (allowed.supervisorIds && !allowed.collegeIds && !allowed.departmentIds) {
      throw AppError.notFound();
    }
  }

  if (query.departmentId) {
    const dept = departmentMap.get(String(query.departmentId));
    if (!dept) throw AppError.notFound();
    if (allowed.departmentIds && !allowed.departmentIds.has(String(query.departmentId))) {
      throw AppError.notFound();
    }
    if (allowed.collegeIds && !allowed.collegeIds.has(String(dept.collegeId))) {
      throw AppError.notFound();
    }
  }
}

export async function resolveReportContext({ scopeFilter, query }) {
  const allowed = extractAllowedScope(scopeFilter);
  const { colleges, departments, academicYears } = await listReportOrgEntities();
  const collegeMap = new Map(colleges.map((c) => [String(c._id), c]));
  const departmentMap = new Map(departments.map((d) => [String(d._id), d]));
  const academicYearMap = new Map(academicYears.map((y) => [String(y._id), y]));

  assertQueryWithinScope({ allowed, query, departmentMap, academicYearMap });

  let scopeType = 'university';
  let scopeId = null;

  if (query.departmentId) {
    scopeType = 'department';
    scopeId = toObjectId(query.departmentId);
  } else if (query.collegeId) {
    scopeType = 'college';
    scopeId = toObjectId(query.collegeId);
  } else if (!allowed.isUniversity) {
    if (allowed.departmentIds && allowed.departmentIds.size === 1 && !allowed.collegeIds) {
      scopeType = 'department';
      scopeId = toObjectId([...allowed.departmentIds][0]);
    } else if (allowed.collegeIds && allowed.collegeIds.size === 1 && !allowed.departmentIds) {
      scopeType = 'college';
      scopeId = toObjectId([...allowed.collegeIds][0]);
    } else if (allowed.supervisorIds && !allowed.collegeIds && !allowed.departmentIds) {
      scopeType = 'supervisor';
      scopeId = toObjectId([...allowed.supervisorIds][0]);
    }
  }

  return {
    allowed,
    colleges,
    departments,
    academicYears,
    collegeMap,
    departmentMap,
    academicYearMap,
    scopeType,
    scopeId,
    baseScopeMatch: buildScopedMatch({ scopeFilter, query }),
  };
}

function buildScopedMatch({ scopeFilter, query }) {
  const parts = [];
  const converted = convertFilterToObjectIds(scopeFilter);
  if (Object.keys(converted).length > 0) parts.push(converted);
  if (query.collegeId) parts.push({ collegeId: toObjectId(query.collegeId) });
  if (query.departmentId) parts.push({ departmentId: toObjectId(query.departmentId) });
  if (query.supervisorId) parts.push({ supervisorIds: toObjectId(query.supervisorId) });
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

export function resolveYearCriteria({ academicYearId, yearLabel, academicYearMap }) {
  if (academicYearId) {
    const ay = academicYearMap.get(String(academicYearId));
    if (!ay) throw AppError.notFound();
    return {
      yearKey: String(ay._id),
      label: ay.label,
      yearMatch: { academicYearId: ay._id },
    };
  }
  return {
    yearKey: yearLabel,
    label: yearLabel,
    yearMatch: { academicYearLabel: yearLabel },
  };
}

export function isAdminCaller(user) {
  return (user?.roles || []).some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
  );
}

export function isCacheableQuery(query, scopeType) {
  const hasSubFilter = Boolean(query.field || query.status || query.supervisorId);
  const supportedScope = ['university', 'college', 'department'].includes(scopeType);
  return !hasSubFilter && supportedScope;
}

export async function withStatsCache({
  kind,
  yearKey,
  scopeType,
  scopeId,
  useCache,
  fresh,
  computeFn,
}) {
  if (useCache && !fresh) {
    const cached = await StatsCache.findOne({
      kind,
      yearKey,
      scopeType,
      scopeId: scopeId || null,
    }).lean();
    if (cached && Date.now() - new Date(cached.computedAt).getTime() <= CACHE_TTL_MS) {
      return { ...cached.data, computedAt: cached.computedAt };
    }
  }

  const data = await computeFn();
  const computedAt = new Date();

  if (useCache) {
    await StatsCache.findOneAndUpdate(
      { kind, yearKey, scopeType, scopeId: scopeId || null },
      { $set: { data, computedAt } },
      { upsert: true, new: true }
    );
  }

  return { ...data, computedAt };
}

export function mergeMatch(a = {}, b = {}) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length === 0) return b;
  if (keysB.length === 0) return a;
  if (a.$and || b.$and || keysA.some((k) => keysB.includes(k))) {
    return { $and: [a, b] };
  }
  return { ...a, ...b };
}
