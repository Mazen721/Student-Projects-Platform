import { z } from 'zod';
import {
  adjustPhaseSchema,
  bomItemSchema,
  coerceNumberFromArabic,
  createSubmissionSchema,
  meetingSchema,
  milestoneSchema,
  objectIdSchema,
  paginationQuerySchema,
  phaseTemplateSchema,
  reviewSubmissionSchema,
  statusFlagSchema,
  taskSchema,
  toolItemSchema,
  updateBomItemSchema,
  updatePhaseTemplateSchema,
  updateTaskSchema,
} from '@spp/shared/schemas';

export const idParamSchema = z.object({ id: objectIdSchema });
export const phaseParamSchema = z.object({ id: objectIdSchema, phaseId: objectIdSchema });
export const deliverableParamSchema = z.object({
  id: objectIdSchema,
  deliverableId: objectIdSchema,
});
export const taskParamSchema = z.object({ taskId: objectIdSchema });
export const bomItemParamSchema = z.object({ itemId: objectIdSchema });
export const toolItemParamSchema = z.object({ toolId: objectIdSchema });
export const meetingActionParamSchema = z.object({
  meetingId: objectIdSchema,
  index: coerceNumberFromArabic(z.number().int().min(0).max(50)),
});

export const reopenPhaseBodySchema = z
  .object({
    reason: z.string().trim().min(3, 'validation.minLength').max(500, 'validation.maxLength'),
  })
  .strict();

export const timelineQuerySchema = paginationQuerySchema.extend({
  type: z.string().trim().max(60).optional(),
});

export {
  adjustPhaseSchema,
  bomItemSchema,
  createSubmissionSchema,
  meetingSchema,
  milestoneSchema,
  phaseTemplateSchema,
  reviewSubmissionSchema,
  statusFlagSchema,
  taskSchema,
  toolItemSchema,
  updateBomItemSchema,
  updatePhaseTemplateSchema,
  updateTaskSchema,
};
