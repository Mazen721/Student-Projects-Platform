import mongoose from 'mongoose';
import { ACADEMIC_YEAR_STATUSES, ORG_STATUSES, SCOPE_TYPES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { AppError } from '../../core/errors/AppError.js';
import AcademicYear from './academicYear.model.js';
import College from './college.model.js';
import Department from './department.model.js';
import University from './university.model.js';

export async function getAllowedEmailDomains() {
  const university = await University.findOne().select('settings.allowedEmailDomains').lean();
  const domains = university?.settings?.allowedEmailDomains;
  return Array.isArray(domains) && domains.length > 0 ? domains : ['mnu.edu.eg'];
}

export async function assertActiveCollegeAndDepartment(collegeId, departmentId) {
  const [college, department] = await Promise.all([
    College.findOne({ _id: collegeId, status: ORG_STATUSES.ACTIVE }).select('_id name').lean(),
    Department.findOne({ _id: departmentId, collegeId, status: ORG_STATUSES.ACTIVE })
      .select('_id name collegeId')
      .lean(),
  ]);

  if (!college || !department) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [
        {
          path: !college ? 'collegeId' : 'departmentId',
          code: 'validation.required',
          message: t('errors.NOT_FOUND'),
        },
      ],
    });
  }

  return { college, department };
}

export async function resolveScopeHierarchy(scopeType, scopeId) {
  if (scopeType === SCOPE_TYPES.UNIVERSITY || scopeType === SCOPE_TYPES.SELF) {
    const university = await University.findOne().select('name').lean();
    return {
      scopeId: null,
      collegeId: null,
      departmentId: null,
      scopeLabel: university?.name || t('common.universityName'),
    };
  }

  if (scopeType === SCOPE_TYPES.COLLEGE) {
    if (!scopeId) {
      throw new AppError('VALIDATION_ERROR', {
        fields: [{ path: 'scopeId', code: 'validation.required', message: t('validation.required') }],
      });
    }
    const college = await College.findOne({ _id: scopeId, status: ORG_STATUSES.ACTIVE })
      .select('_id name')
      .lean();
    if (!college) {
      throw AppError.notFound();
    }
    return {
      scopeId: college._id,
      collegeId: college._id,
      departmentId: null,
      scopeLabel: college.name,
    };
  }

  if (scopeType === SCOPE_TYPES.DEPARTMENT) {
    if (!scopeId) {
      throw new AppError('VALIDATION_ERROR', {
        fields: [{ path: 'scopeId', code: 'validation.required', message: t('validation.required') }],
      });
    }
    const dept = await Department.findOne({ _id: scopeId, status: ORG_STATUSES.ACTIVE })
      .select('_id name collegeId')
      .lean();
    if (!dept) {
      throw AppError.notFound();
    }
    const college = await College.findById(dept.collegeId).select('name').lean();
    return {
      scopeId: dept._id,
      collegeId: dept.collegeId,
      departmentId: dept._id,
      scopeLabel: college ? `${college.name} — ${dept.name}` : dept.name,
    };
  }

  throw AppError.forbidden();
}

export async function getCollegeAndCurrentYear(collegeId) {
  const [college, currentYear] = await Promise.all([
    College.findOne({ _id: collegeId, status: ORG_STATUSES.ACTIVE })
      .select('_id name code settings')
      .lean(),
    AcademicYear.findOne({
      collegeId,
      isCurrent: true,
      status: ACADEMIC_YEAR_STATUSES.ACTIVE,
    }).lean(),
  ]);
  return { college, currentYear };
}

export async function getAcademicYearInfo(academicYearId) {
  return AcademicYear.findById(academicYearId).lean();
}

export async function getCollegesAndDepartmentsMap(collegeIds = [], departmentIds = []) {
  const uniqueColleges = [...new Set(collegeIds.filter(Boolean).map(String))];
  const uniqueDepts = [...new Set(departmentIds.filter(Boolean).map(String))];
  const [colleges, departments] = await Promise.all([
    uniqueColleges.length > 0
      ? College.find({ _id: mongoose.trusted({ $in: uniqueColleges }) }).select('_id name code settings').lean()
      : [],
    uniqueDepts.length > 0
      ? Department.find({ _id: mongoose.trusted({ $in: uniqueDepts }) }).select('_id name code collegeId').lean()
      : [],
  ]);

  return {
    collegeMap: new Map(colleges.map((c) => [String(c._id), c])),
    departmentMap: new Map(departments.map((d) => [String(d._id), d])),
  };
}
