import { z } from 'zod';
import {
  BOM_STATUS_VALUES,
  STATUS_FLAG_VALUES,
  SUBMISSION_DECISION_VALUES,
  TASK_COLUMN_VALUES,
  TOOL_CATEGORY_VALUES,
  WEIGHT_TOLERANCE,
} from '../constants/index.js';
import {
  cloudinaryUploadResultSchema,
  coerceNumberFromArabic,
  linkRefSchema,
  objectIdSchema,
} from './common.js';

const requiredDeliverableDefSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    title: z.string().trim().min(2, 'validation.minLength').max(150, 'validation.maxLength'),
    description: z.string().trim().max(1000).optional(),
    allowedTypes: z.array(z.string().trim().min(1).max(30)).optional(),
  })
  .strict();

const phaseDefSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    order: coerceNumberFromArabic(z.number().int().min(1).max(50)),
    weight: coerceNumberFromArabic(z.number().min(0).max(100)),
    dueDate: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }).optional(),
    dueOffsetDays: coerceNumberFromArabic(z.number().int().min(1).max(365)).optional(),
    requiredDeliverables: z.array(requiredDeliverableDefSchema).default([]),
    forms: z.array(cloudinaryUploadResultSchema).default([]),
  })
  .strict();

export const phaseTemplateSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    isDefault: z.boolean().default(true),
    phases: z.array(phaseDefSchema).min(1, 'validation.minItems').max(20),
  })
  .strict()
  .refine(
    (tpl) => {
      const total = tpl.phases.reduce((sum, p) => sum + p.weight, 0);
      return Math.abs(total - 100) <= WEIGHT_TOLERANCE;
    },
    { message: 'validation.weightsSum100', path: ['phases'] }
  );

export const updatePhaseTemplateSchema = phaseTemplateSchema.innerType().partial().strict();

export const adjustPhaseSchema = z
  .object({
    dueDate: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
  })
  .strict();

export const milestoneSchema = z
  .object({
    title: z.string().trim().min(2, 'validation.minLength').max(150, 'validation.maxLength'),
    dueDate: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
  })
  .strict();

export const createSubmissionSchema = z
  .object({
    files: z.array(cloudinaryUploadResultSchema).max(10).default([]),
    links: z.array(linkRefSchema).max(10).default([]),
    note: z.string().trim().max(1000, 'validation.maxLength').optional(),
  })
  .strict()
  .refine((sub) => sub.files.length > 0 || sub.links.length > 0, {
    message: 'validation.minItems',
    path: ['files'],
  });

export const reviewSubmissionSchema = z
  .object({
    decision: z.enum(SUBMISSION_DECISION_VALUES, { message: 'validation.invalidEnum' }),
    comment: z.string().trim().max(1500, 'validation.maxLength').optional(),
  })
  .strict();

export const statusFlagSchema = z
  .object({
    statusFlag: z.enum(STATUS_FLAG_VALUES, { message: 'validation.invalidEnum' }),
  })
  .strict();

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, 'validation.minLength').max(200, 'validation.maxLength'),
    description: z.string().trim().max(2000).optional(),
    column: z.enum(TASK_COLUMN_VALUES, { message: 'validation.invalidEnum' }).default('todo'),
    assigneeIds: z.array(objectIdSchema).max(10).default([]),
    dueDate: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }).optional(),
  })
  .strict();

export const updateTaskSchema = taskSchema
  .extend({
    order: z.string().min(1).max(64),
  })
  .partial()
  .strict();

export const bomItemSchema = z
  .object({
    item: z.string().trim().min(2, 'validation.minLength').max(150, 'validation.maxLength'),
    quantity: coerceNumberFromArabic(z.number().int('validation.positiveInt').min(1, 'validation.minValue')),
    specs: z.string().trim().max(500).optional(),
    unitPrice: coerceNumberFromArabic(z.number().min(0, 'validation.minValue')),
    supplier: z.string().trim().max(150).optional(),
    status: z.enum(BOM_STATUS_VALUES, { message: 'validation.invalidEnum' }).default('needed'),
  })
  .strict();

export const updateBomItemSchema = bomItemSchema.partial().strict();

export const toolItemSchema = z
  .object({
    category: z.enum(TOOL_CATEGORY_VALUES, { message: 'validation.invalidEnum' }),
    name: z.string().trim().min(1, 'validation.required').max(100, 'validation.maxLength'),
    version: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const meetingSchema = z
  .object({
    date: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
    attendeeIds: z.array(objectIdSchema).min(1, 'validation.minItems').max(20),
    notes: z.string().trim().min(3, 'validation.minLength').max(3000, 'validation.maxLength'),
    actionItems: z
      .array(
        z
          .object({
            text: z.string().trim().min(2, 'validation.minLength').max(300),
            assigneeId: objectIdSchema.optional(),
          })
          .strict()
      )
      .max(20)
      .default([]),
  })
  .strict();
