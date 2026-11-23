import mongoose from 'mongoose';
import {
  DEFAULT_GRADE_SPREAD_THRESHOLD,
  ROLES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { AppError } from '../../core/errors/AppError.js';
import { findUsersBasicByIds } from '../auth/index.js';
import Defense from './defense.model.js';

const BUSINESS_RULE_CODES = new Set([
  'NOT_ELIGIBLE_FOR_DEFENSE',
  'COI_VIOLATION',
  'SCORES_INCOMPLETE',
  'SPREAD_NOT_EXCEEDED',
  'DELIBERATION_LIMIT_REACHED',
  'REEVAL_ALREADY_REQUESTED',
  'RUBRIC_IN_USE',
  'PRIMARY_SUPERVISOR_DEACTIVATED',
  'INDEPENDENT_EXAMINER_REQUIRED',
]);

export function getActorRoleName(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  return roles[0]?.role || '';
}

export function isStaffAdmin(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  return roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
  );
}

export function throwMachineError(code) {
  if (BUSINESS_RULE_CODES.has(code)) {
    throw AppError.businessRule(code);
  }
  if (code === 'WINDOW_CLOSED') {
    throw new AppError('WINDOW_CLOSED');
  }
  if (code === 'VALIDATION_ERROR') {
    throw new AppError('VALIDATION_ERROR');
  }
  if (code === 'FORBIDDEN') {
    throw AppError.forbidden();
  }
  throw new AppError('INVALID_TRANSITION');
}

export function collectCommitteeExaminerIds(committee = {}) {
  const unique = new Set();
  if (committee.chairId) unique.add(String(committee.chairId));
  for (const id of committee.memberIds || []) unique.add(String(id));
  for (const id of committee.externalExaminerIds || []) unique.add(String(id));
  return Array.from(unique);
}

export async function assertValidCommittee(committeePayload, project, { session = null } = {}) {
  const examinerIds = collectCommitteeExaminerIds(committeePayload);
  if (!committeePayload?.chairId || examinerIds.length === 0) {
    throw AppError.businessRule('INDEPENDENT_EXAMINER_REQUIRED');
  }

  const supervisorSet = new Set((project.supervisorIds || []).map(String));
  if (project.supervision?.primaryId) supervisorSet.add(String(project.supervision.primaryId));
  if (project.supervision?.reviewerId) supervisorSet.add(String(project.supervision.reviewerId));
  for (const id of project.supervision?.coSupervisorIds || []) supervisorSet.add(String(id));
  for (const id of project.supervision?.mentorIds || []) supervisorSet.add(String(id));

  const teamSet = new Set((project.activeMemberIds || []).map(String));

  for (const id of examinerIds) {
    if (supervisorSet.has(id) || teamSet.has(id)) {
      throw AppError.businessRule('COI_VIOLATION');
    }
  }

  const userMap = await findUsersBasicByIds(examinerIds, session);
  for (const id of examinerIds) {
    const user = userMap.get(id);
    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      throw AppError.notFound();
    }
  }

  return { examinerIds, userMap };
}

export function intervalsOverlap(startA, durationMinA, startB, durationMinB) {
  const a0 = new Date(startA).getTime();
  const a1 = a0 + Number(durationMinA || 60) * 60000;
  const b0 = new Date(startB).getTime();
  const b1 = b0 + Number(durationMinB || 60) * 60000;
  return a0 < b1 && b0 < a1;
}

export async function findScheduleConflicts({
  excludeDefenseId = null,
  scheduledAt,
  durationMin = 60,
  room,
  examinerIds = [],
}) {
  const targetStart = new Date(scheduledAt).getTime();
  const windowStart = new Date(targetStart - 240 * 60000);
  const windowEnd = new Date(targetStart + Number(durationMin) * 60000);

  const orClauses = [];
  const trimmedRoom = typeof room === 'string' ? room.trim() : '';
  if (trimmedRoom) {
    orClauses.push({ room: trimmedRoom });
  }
  if (examinerIds.length > 0) {
    orClauses.push({ examinerIds: mongoose.trusted({ $in: examinerIds }) });
  }
  if (orClauses.length === 0) return [];

  const filter = {
    scheduledAt: mongoose.trusted({ $gte: windowStart, $lt: windowEnd }),
    $or: orClauses,
  };
  if (excludeDefenseId) {
    filter._id = mongoose.trusted({ $ne: excludeDefenseId });
  }

  const candidates = await Defense.find(filter)
    .select('_id projectId scheduledAt durationMin room examinerIds')
    .lean();

  const examinerSet = new Set(examinerIds.map(String));
  const conflicts = [];

  for (const candidate of candidates) {
    if (!intervalsOverlap(scheduledAt, durationMin, candidate.scheduledAt, candidate.durationMin)) {
      continue;
    }
    if (trimmedRoom && candidate.room && candidate.room.trim() === trimmedRoom) {
      conflicts.push({
        type: 'room',
        defenseId: String(candidate._id),
        projectId: String(candidate.projectId),
        room: candidate.room,
        scheduledAt: candidate.scheduledAt,
      });
    }
    const overlappingExaminers = (candidate.examinerIds || [])
      .map(String)
      .filter((id) => examinerSet.has(id));
    if (overlappingExaminers.length > 0) {
      conflicts.push({
        type: 'examiner',
        defenseId: String(candidate._id),
        projectId: String(candidate.projectId),
        examinerIds: overlappingExaminers,
        scheduledAt: candidate.scheduledAt,
      });
    }
  }

  return conflicts;
}

export function resolveCollegeSettings(college) {
  return {
    passMark: Number(college?.settings?.passMark ?? 60),
    gradeSpreadThreshold: Number(
      college?.settings?.gradeSpreadThreshold ?? DEFAULT_GRADE_SPREAD_THRESHOLD
    ),
    reevaluationWindowDays: Number(college?.settings?.reevaluationWindowDays ?? 7),
  };
}
