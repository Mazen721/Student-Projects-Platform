import { hashIp } from '../auth/tokens.js';
import { buildPageMeta, parsePagination } from '../pagination.js';
import AuditLog from './auditlog.model.js';

const REDACTED_KEYS = new Set([
  'passwordHash',
  'temporaryPassword',
  'tokenHash',
  'jtiHash',
  'ipHash',
  'password',
]);

export function redactSensitive(value) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  const output = {};
  for (const [key, val] of Object.entries(value)) {
    if (REDACTED_KEYS.has(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSensitive(val);
    }
  }
  return output;
}

export async function recordAudit({
  actorId = null,
  actorRole = '',
  action,
  targetType,
  targetId = null,
  scope = {},
  before = null,
  after = null,
  reason,
  ip = '',
  session,
}) {
  const payload = {
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    scope: {
      collegeId: scope.collegeId || null,
      departmentId: scope.departmentId || null,
      projectId: scope.projectId || null,
    },
    before: redactSensitive(before),
    after: redactSensitive(after),
    reason,
    ipHash: hashIp(ip),
    at: new Date(),
  };
  const docs = await AuditLog.create([payload], session ? { session } : undefined);
  return docs[0];
}

export async function listAuditLogs(scopeFilter = {}, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['-at', 'at']);
  const filter = { ...scopeFilter };
  if (query.action) filter.action = query.action;
  if (query.actorId) filter.actorId = query.actorId;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = query.targetId;
  if (query.from || query.to) {
    filter.at = {};
    if (query.from) filter.at.$gte = new Date(query.from);
    if (query.to) filter.at.$lte = new Date(query.to);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    page: buildPageMeta({ page, limit, total }),
  };
}
