import { Router } from 'express';
import multer from 'multer';
import { MAX_IMPORT_BYTES } from '@spp/shared/constants';
import { authorize, publicRoute } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import * as ctrl from './organization.controller.js';
import {
  academicYearSchema,
  auditLogQuerySchema,
  collegeSettingsSchema,
  createCollegeSchema,
  createDepartmentSchema,
  idParamSchema,
  importKindQuerySchema,
  listCollegesQuerySchema,
  paginationQuerySchema,
  reasonBodySchema,
  universitySettingsSchema,
  updateAcademicYearSchema,
  updateCollegeSchema,
  updateDepartmentSchema,
} from './organization.validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES },
});

export function createOrganizationRouter(limiters) {
  const router = Router();
  const { writeLimiter } = limiters;

  router.get('/public/university', publicRoute(), ctrl.getPublicUniversityHandler);
  router.get('/public/colleges', publicRoute(), ctrl.getPublicCollegesHandler);
  router.get(
    '/public/colleges/:id/departments',
    publicRoute(),
    validate({ params: idParamSchema }),
    ctrl.getPublicCollegeDepartmentsHandler
  );

  router.get('/university', authorize('university.read', 'university'), ctrl.getUniversityHandler);
  router.patch(
    '/university/settings',
    authorize('university.update', 'university'),
    writeLimiter,
    validate({ body: universitySettingsSchema }),
    ctrl.updateUniversitySettingsHandler
  );

  router.get(
    '/colleges',
    authorize('college.list', 'scope'),
    validate({ query: listCollegesQuerySchema }),
    ctrl.listCollegesHandler
  );
  router.post(
    '/colleges',
    authorize('college.create', 'university'),
    writeLimiter,
    validate({ body: createCollegeSchema }),
    ctrl.createCollegeHandler
  );
  router.get(
    '/colleges/:id',
    authorize('college.read', 'college'),
    validate({ params: idParamSchema }),
    ctrl.getCollegeHandler
  );
  router.patch(
    '/colleges/:id',
    authorize('college.update', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateCollegeSchema }),
    ctrl.updateCollegeHandler
  );
  router.patch(
    '/colleges/:id/settings',
    authorize('college.updateSettings', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: collegeSettingsSchema }),
    ctrl.updateCollegeSettingsHandler
  );
  router.post(
    '/colleges/:id/deactivate',
    authorize('college.deactivate', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.deactivateCollegeHandler
  );

  router.get(
    '/colleges/:id/departments',
    authorize('department.list', 'college'),
    validate({ params: idParamSchema, query: paginationQuerySchema }),
    ctrl.listDepartmentsHandler
  );
  router.post(
    '/colleges/:id/departments',
    authorize('department.create', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: createDepartmentSchema }),
    ctrl.createDepartmentHandler
  );
  router.patch(
    '/departments/:id',
    authorize('department.update', 'department'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateDepartmentSchema }),
    ctrl.updateDepartmentHandler
  );
  router.post(
    '/departments/:id/deactivate',
    authorize('department.deactivate', 'department'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.deactivateDepartmentHandler
  );

  router.get(
    '/colleges/:id/academic-years',
    authorize('academicYear.list', 'college'),
    validate({ params: idParamSchema }),
    ctrl.listAcademicYearsHandler
  );
  router.post(
    '/colleges/:id/academic-years',
    authorize('academicYear.create', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: academicYearSchema }),
    ctrl.createAcademicYearHandler
  );
  router.patch(
    '/academic-years/:id',
    authorize('academicYear.update', 'academicYear'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateAcademicYearSchema }),
    ctrl.updateAcademicYearHandler
  );
  router.post(
    '/academic-years/:id/set-current',
    authorize('academicYear.update', 'academicYear'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.setCurrentAcademicYearHandler
  );
  router.post(
    '/academic-years/:id/rollover',
    authorize('academicYear.rollover', 'academicYear'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.rolloverAcademicYearHandler
  );

  router.get(
    '/imports/template',
    authorize('import.run', 'scope'),
    validate({ query: importKindQuerySchema }),
    ctrl.downloadImportTemplateHandler
  );
  router.post(
    '/colleges/:id/imports',
    authorize('import.run', 'college'),
    writeLimiter,
    upload.single('file'),
    validate({ params: idParamSchema, query: importKindQuerySchema }),
    ctrl.runBulkImportHandler
  );

  router.get(
    '/audit-logs',
    authorize('audit.list', 'scope'),
    validate({ query: auditLogQuerySchema }),
    ctrl.listAuditLogsHandler
  );
  router.get('/dashboard/home', authorize('dashboard.home', 'self'), ctrl.getHomeDashboardHandler);

  return router;
}
