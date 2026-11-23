import { z } from 'zod';
import {
  PROJECT_FIELD_VALUES,
  PROPOSAL_STATUS_VALUES,
} from '@spp/shared/constants';
import {
  objectIdSchema,
  paginationQuerySchema,
  reportQuerySchema,
} from '@spp/shared/schemas';

export { reportQuerySchema };

export const projectsReportQuerySchema = reportQuerySchema.and(paginationQuerySchema);

export const supervisorSelfQuerySchema = z.object({
  academicYearId: objectIdSchema.optional(),
  yearLabel: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'validation.yearLabelFormat').optional(),
  field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }).optional(),
  status: z.enum(PROPOSAL_STATUS_VALUES, { message: 'validation.invalidEnum' }).optional(),
  format: z.enum(['json', 'xlsx', 'pdf'], { message: 'validation.invalidEnum' }).default('json'),
});
