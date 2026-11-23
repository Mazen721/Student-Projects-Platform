import { z } from 'zod';
import {
  academicYearSchema,
  auditLogQuerySchema,
  collegeSettingsSchema,
  createCollegeSchema,
  createDepartmentSchema,
  listCollegesQuerySchema,
  objectIdSchema,
  paginationQuerySchema,
  reasonBodySchema,
  universitySettingsSchema,
  updateAcademicYearSchema,
  updateCollegeSchema,
  updateDepartmentSchema,
} from '@spp/shared/schemas';

export const idParamSchema = z.object({ id: objectIdSchema });
export const importKindQuerySchema = z.object({
  kind: z.enum(['students', 'supervisors'], { message: 'validation.invalidEnum' }),
});

export {
  academicYearSchema,
  auditLogQuerySchema,
  collegeSettingsSchema,
  createCollegeSchema,
  createDepartmentSchema,
  listCollegesQuerySchema,
  paginationQuerySchema,
  reasonBodySchema,
  universitySettingsSchema,
  updateAcademicYearSchema,
  updateCollegeSchema,
  updateDepartmentSchema,
};
