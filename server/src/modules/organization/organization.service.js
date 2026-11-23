import mongoose from 'mongoose';
import { ACADEMIC_YEAR_STATUSES, ORG_STATUSES, ROLES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { normalizeArabic } from '@spp/shared/text';
import { listAuditLogs, recordAudit } from '../../core/audit/audit.service.js';
import { resolveRoleContext } from '../../core/authz/scopeFilter.js';
import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { getAuthDashboardCounts } from '../auth/index.js';
import AcademicYear from './academicYear.model.js';
import College from './college.model.js';
import Department from './department.model.js';
import University from './university.model.js';

function actorRoleName(actor) {
  return actor?.roles?.[0]?.role || '';
}

export async function getUniversity() {
  let uni = await University.findOne().lean();
  if (!uni) {
    uni = await University.create({ name: t('common.universityName') });
    return uni.toObject();
  }
  return uni;
}

export async function getPublicUniversity() {
  const uni = await getUniversity();
  return {
    name: uni.name,
    logo: uni.logo || null,
  };
}

export async function updateUniversitySettings(payload, { actor, ip }) {
  let uni = await University.findOne();
  if (!uni) {
    uni = new University({ name: t('common.universityName') });
  }
  const before = uni.toObject();

  if (payload.allowedEmailDomains !== undefined) {
    uni.settings.allowedEmailDomains = payload.allowedEmailDomains;
  }
  if (payload.minVoteAccountAgeHours !== undefined) {
    uni.settings.minVoteAccountAgeHours = payload.minVoteAccountAgeHours;
  }
  if (payload.voteBurstPerIp10m !== undefined) {
    uni.settings.voteBurstPerIp10m = payload.voteBurstPerIp10m;
  }
  await uni.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'university.update',
    targetType: 'university',
    targetId: uni._id,
    before,
    after: uni.toObject(),
    ip,
  });

  return uni.toObject();
}

export async function listColleges(scopeFilter = {}, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['name', '-name', '-createdAt', 'createdAt']);
  const filter = { ...scopeFilter };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    College.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    College.countDocuments(filter),
  ]);

  return {
    items,
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function listPublicColleges() {
  const colleges = await College.find({ status: ORG_STATUSES.ACTIVE })
    .select('_id name code')
    .sort({ name: 1 })
    .lean();
  return colleges;
}

export async function listPublicCollegeDepartments(collegeId) {
  const college = await College.findOne({ _id: collegeId, status: ORG_STATUSES.ACTIVE })
    .select('_id')
    .lean();
  if (!college) {
    throw AppError.notFound();
  }
  return Department.find({ collegeId, status: ORG_STATUSES.ACTIVE })
    .select('_id name code collegeId')
    .sort({ name: 1 })
    .lean();
}

export async function createCollege(payload, { actor, ip }) {
  const college = await College.create({
    name: payload.name,
    code: payload.code.toUpperCase(),
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'college.create',
    targetType: 'college',
    targetId: college._id,
    after: college.toObject(),
    ip,
  });

  return college.toObject();
}

export async function getCollegeById(collegeId) {
  const college = await College.findById(collegeId).lean();
  if (!college) {
    throw AppError.notFound();
  }
  return college;
}

export async function updateCollege(collegeId, payload, { actor, ip }) {
  const college = await College.findById(collegeId);
  if (!college) {
    throw AppError.notFound();
  }
  const before = college.toObject();
  if (payload.name !== undefined) {
    college.name = payload.name;
    college.nameNormalized = normalizeArabic(payload.name);
  }
  if (payload.code !== undefined) {
    college.code = payload.code.toUpperCase();
  }
  await college.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'college.update',
    targetType: 'college',
    targetId: college._id,
    scope: { collegeId: college._id },
    before,
    after: college.toObject(),
    ip,
  });

  return college.toObject();
}

export async function updateCollegeSettings(collegeId, payload, { actor, ip }) {
  const college = await College.findById(collegeId);
  if (!college) {
    throw AppError.notFound();
  }

  const nextMin = payload.teamSizeMin ?? college.settings.teamSizeMin;
  const nextMax = payload.teamSizeMax ?? college.settings.teamSizeMax;
  if (nextMax < nextMin) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [
        {
          path: 'teamSizeMax',
          code: 'validation.teamSizeOrder',
          message: t('validation.teamSizeOrder'),
        },
      ],
    });
  }

  const before = college.toObject();
  Object.assign(college.settings, payload);
  await college.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'college.updateSettings',
    targetType: 'college',
    targetId: college._id,
    scope: { collegeId: college._id },
    before,
    after: college.toObject(),
    ip,
  });

  return college.toObject();
}

export async function deactivateCollege(collegeId, { reason }, { actor, ip }) {
  const college = await College.findById(collegeId);
  if (!college) {
    throw AppError.notFound();
  }
  const before = college.toObject();
  college.status = ORG_STATUSES.DEACTIVATED;
  await college.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'college.deactivate',
    targetType: 'college',
    targetId: college._id,
    scope: { collegeId: college._id },
    before,
    after: college.toObject(),
    reason,
    ip,
  });

  return college.toObject();
}

export async function listDepartments(collegeId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['name', '-name', '-createdAt']);
  const filter = { collegeId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Department.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);

  return {
    items,
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function createDepartment(collegeId, payload, { actor, ip }) {
  const college = await College.findOne({ _id: collegeId, status: ORG_STATUSES.ACTIVE }).lean();
  if (!college) {
    throw AppError.notFound();
  }

  const department = await Department.create({
    name: payload.name,
    code: payload.code.toUpperCase(),
    collegeId,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'department.create',
    targetType: 'department',
    targetId: department._id,
    scope: { collegeId, departmentId: department._id },
    after: department.toObject(),
    ip,
  });

  return department.toObject();
}

export async function updateDepartment(departmentId, payload, { actor, ip }) {
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw AppError.notFound();
  }
  const before = dept.toObject();
  if (payload.name !== undefined) dept.name = payload.name;
  if (payload.code !== undefined) dept.code = payload.code.toUpperCase();
  await dept.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'department.update',
    targetType: 'department',
    targetId: dept._id,
    scope: { collegeId: dept.collegeId, departmentId: dept._id },
    before,
    after: dept.toObject(),
    ip,
  });

  return dept.toObject();
}

export async function deactivateDepartment(departmentId, { reason }, { actor, ip }) {
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw AppError.notFound();
  }
  const before = dept.toObject();
  dept.status = ORG_STATUSES.DEACTIVATED;
  await dept.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'department.deactivate',
    targetType: 'department',
    targetId: dept._id,
    scope: { collegeId: dept.collegeId, departmentId: dept._id },
    before,
    after: dept.toObject(),
    reason,
    ip,
  });

  return dept.toObject();
}

export async function listAcademicYears(collegeId) {
  return AcademicYear.find({ collegeId }).sort({ startDate: -1 }).lean();
}

export async function createAcademicYear(collegeId, payload, { actor, ip }) {
  const college = await College.findOne({ _id: collegeId, status: ORG_STATUSES.ACTIVE }).lean();
  if (!college) {
    throw AppError.notFound();
  }

  const academicYear = await AcademicYear.create({
    ...payload,
    collegeId,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'academicYear.create',
    targetType: 'academicYear',
    targetId: academicYear._id,
    scope: { collegeId },
    after: academicYear.toObject(),
    ip,
  });

  return academicYear.toObject();
}

export async function updateAcademicYear(academicYearId, payload, { actor, ip }) {
  const ay = await AcademicYear.findById(academicYearId);
  if (!ay) {
    throw AppError.notFound();
  }
  const before = ay.toObject();

  if (payload.label !== undefined) ay.label = payload.label;
  if (payload.startDate !== undefined) ay.startDate = payload.startDate;
  if (payload.endDate !== undefined) ay.endDate = payload.endDate;
  if (payload.semesters !== undefined) ay.semesters = payload.semesters;
  if (payload.cycle !== undefined) {
    ay.cycle = { ...ay.cycle?.toObject?.(), ...payload.cycle };
  }

  if (ay.endDate <= ay.startDate) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'endDate', code: 'validation.dateOrder', message: t('validation.dateOrder') }],
    });
  }

  await ay.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actorRoleName(actor),
    action: 'academicYear.update',
    targetType: 'academicYear',
    targetId: ay._id,
    scope: { collegeId: ay.collegeId },
    before,
    after: ay.toObject(),
    ip,
  });

  return ay.toObject();
}

export async function setCurrentAcademicYear(academicYearId, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const ay = await AcademicYear.findById(academicYearId).session(session);
      if (!ay) {
        throw AppError.notFound();
      }
      if (ay.status === ACADEMIC_YEAR_STATUSES.ARCHIVED) {
        throw new AppError('INVALID_TRANSITION');
      }

      const before = ay.toObject();
      await AcademicYear.updateMany(
        { collegeId: ay.collegeId, isCurrent: true, _id: mongoose.trusted({ $ne: ay._id }) },
        { $set: { isCurrent: false } },
        { session }
      );
      ay.isCurrent = true;
      await ay.save({ session });

      await recordAudit({
        actorId: actor.id,
        actorRole: actorRoleName(actor),
        action: 'academicYear.setCurrent',
        targetType: 'academicYear',
        targetId: ay._id,
        scope: { collegeId: ay.collegeId },
        before,
        after: ay.toObject(),
        ip,
        session,
      });

      updated = ay.toObject();
    });
    return updated;
  } finally {
    await session.endSession();
  }
}

export async function rolloverAcademicYear(academicYearId, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const ay = await AcademicYear.findById(academicYearId).session(session);
      if (!ay) {
        throw AppError.notFound();
      }
      if (ay.status === ACADEMIC_YEAR_STATUSES.ARCHIVED) {
        throw new AppError('INVALID_TRANSITION');
      }

      const before = ay.toObject();
      ay.status = ACADEMIC_YEAR_STATUSES.ARCHIVED;
      ay.isCurrent = false;
      await ay.save({ session });

      const archivedProjects = 0;

      await recordAudit({
        actorId: actor.id,
        actorRole: actorRoleName(actor),
        action: 'academicYear.rollover',
        targetType: 'academicYear',
        targetId: ay._id,
        scope: { collegeId: ay.collegeId },
        before,
        after: { ...ay.toObject(), archivedProjects },
        ip,
        session,
      });

      result = { academicYear: ay.toObject(), archivedProjects };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function listScopedAuditLogs(scopeFilter, query) {
  return listAuditLogs(scopeFilter, query);
}

function selectActiveRoleAssignment(user, roleContextHeader) {
  if (roleContextHeader) {
    const resolved = resolveRoleContext(user, roleContextHeader);
    return resolved.roles[0];
  }
  const priority = [
    ROLES.UNIVERSITY_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.DEPARTMENT_ADMIN,
    ROLES.SUPERVISOR,
    ROLES.COMMITTEE_MEMBER,
    ROLES.STUDENT,
    ROLES.INVESTOR,
    ROLES.VISITOR,
  ];
  const assignments = Array.isArray(user?.roles) ? user.roles : [];
  for (const role of priority) {
    const found = assignments.find((a) => a.role === role);
    if (found) return found;
  }
  return assignments[0] || null;
}

export async function getHomeDashboard(user, roleContextHeader) {
  const activeAssignment = selectActiveRoleAssignment(user, roleContextHeader);
  const activeRole = activeAssignment?.role || null;
  const collegeId = activeAssignment?.collegeId || user.collegeId || null;

  const [collegesCount, departmentsCount, currentYear, authStats] = await Promise.all([
    College.countDocuments({ status: ORG_STATUSES.ACTIVE }),
    collegeId
      ? Department.countDocuments({ collegeId, status: ORG_STATUSES.ACTIVE })
      : Department.countDocuments({ status: ORG_STATUSES.ACTIVE }),
    collegeId ? AcademicYear.findOne({ collegeId, isCurrent: true }).lean() : null,
    getAuthDashboardCounts(collegeId ? { collegeId } : {}),
  ]);

  return {
    activeRole,
    activeRoleAssignment: activeAssignment,
    userStatus: user.status,
    summary: {
      collegesCount,
      departmentsCount,
      totalUsers: authStats.totalUsers,
      pendingInvestors: activeRole === ROLES.UNIVERSITY_ADMIN ? authStats.pendingInvestors : 0,
      currentAcademicYear: currentYear
        ? {
            id: String(currentYear._id),
            label: currentYear.label,
            cycle: currentYear.cycle,
          }
        : null,
    },
  };
}
