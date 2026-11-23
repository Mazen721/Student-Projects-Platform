import { z } from 'zod';
import {
  decideReevaluationSchema,
  defenseMinutesSchema,
  defenseTransitionSchema,
  objectIdSchema,
  paginationQuerySchema,
  reevaluationRequestSchema,
  rubricSchema,
  scheduleDefenseSchema,
  scoresSchema,
  updateRubricSchema,
} from '@spp/shared/schemas';

export {
  decideReevaluationSchema,
  defenseMinutesSchema,
  defenseTransitionSchema,
  reevaluationRequestSchema,
  rubricSchema,
  scheduleDefenseSchema,
  scoresSchema,
  updateRubricSchema,
};

export const idParamSchema = z.object({ id: objectIdSchema }).strict();

export const certificateParamsSchema = z
  .object({
    id: objectIdSchema,
    studentId: objectIdSchema,
  })
  .strict();

export const listRubricsQuerySchema = z
  .object({
    academicYearId: objectIdSchema.optional(),
  })
  .strict();

export const rescheduleDefenseSchema = scheduleDefenseSchema
  .innerType()
  .partial()
  .strict();

export const listDefensesQuerySchema = paginationQuerySchema
  .extend({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    collegeId: objectIdSchema.optional(),
    room: z.string().trim().max(100).optional(),
    examinerId: objectIdSchema.optional(),
  })
  .strict();

export const externalExaminerInviteSchema = z
  .object({
    defenseId: objectIdSchema,
    name: z.string().trim().min(2, 'validation.minLength').max(100, 'validation.maxLength'),
  })
  .strict();

export const listReevaluationsQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
  })
  .strict();
