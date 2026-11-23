import { z } from 'zod';
import { PROJECT_FIELD_VALUES, PROPOSAL_STATUS_VALUES } from '../constants/index.js';
import { objectIdSchema } from './common.js';

const yearLabelSchema = z.string().trim().regex(/^\d{4}\/\d{4}$/, 'validation.yearLabelFormat');

export const reportQuerySchema = z
  .object({
    academicYearId: objectIdSchema.optional(),
    yearLabel: yearLabelSchema.optional(),
    compareYearId: objectIdSchema.optional(),
    compareYearLabel: yearLabelSchema.optional(),
    collegeId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    supervisorId: objectIdSchema.optional(),
    field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }).optional(),
    status: z.enum(PROPOSAL_STATUS_VALUES, { message: 'validation.invalidEnum' }).optional(),
    format: z.enum(['json', 'xlsx', 'pdf'], { message: 'validation.invalidEnum' }).default('json'),
    fresh: z.enum(['true', 'false']).optional(),
  })
  .refine((q) => Boolean(q.academicYearId) || Boolean(q.yearLabel), {
    message: 'validation.required',
    path: ['academicYearId'],
  });
