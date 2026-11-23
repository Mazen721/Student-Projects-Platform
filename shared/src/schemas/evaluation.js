import { z } from 'zod';
import {
  DEFENSE_DURATION_DEFAULT,
  DEFENSE_DURATION_MAX,
  DEFENSE_DURATION_MIN,
  RUBRIC_CRITERION_TARGET_VALUES,
  WEIGHT_TOLERANCE,
} from '../constants/index.js';
import { coerceNumberFromArabic, httpsUrlSchema, objectIdSchema } from './common.js';

const rubricCriterionSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    weight: coerceNumberFromArabic(z.number().positive('validation.minValue').max(100)),
    appliesTo: z.enum(RUBRIC_CRITERION_TARGET_VALUES, { message: 'validation.invalidEnum' }),
  })
  .strict();

export const rubricSchema = z
  .object({
    academicYearId: objectIdSchema,
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    supervisorPct: coerceNumberFromArabic(z.number().min(0).max(100)),
    committeePct: coerceNumberFromArabic(z.number().min(0).max(100)),
    criteria: z.array(rubricCriterionSchema).min(1, 'validation.minItems').max(30),
  })
  .strict()
  .refine((r) => Math.abs(r.supervisorPct + r.committeePct - 100) <= WEIGHT_TOLERANCE, {
    message: 'validation.splitSum100',
    path: ['committeePct'],
  })
  .refine(
    (r) => Math.abs(r.criteria.reduce((sum, c) => sum + c.weight, 0) - 100) <= WEIGHT_TOLERANCE,
    { message: 'validation.weightsSum100', path: ['criteria'] }
  );

export const updateRubricSchema = rubricSchema.innerType().innerType().partial().strict();

const committeeSchema = z
  .object({
    chairId: objectIdSchema,
    memberIds: z.array(objectIdSchema).max(10).default([]),
    externalExaminerIds: z.array(objectIdSchema).max(5).default([]),
  })
  .strict();

export const scheduleDefenseSchema = z
  .object({
    scheduledAt: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
    durationMin: coerceNumberFromArabic(
      z.number().int().min(DEFENSE_DURATION_MIN).max(DEFENSE_DURATION_MAX).default(DEFENSE_DURATION_DEFAULT)
    ).default(DEFENSE_DURATION_DEFAULT),
    room: z.string().trim().max(100, 'validation.maxLength').optional(),
    meetingLink: httpsUrlSchema.optional(),
    committee: committeeSchema,
    acknowledgeConflicts: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Boolean(d.room) || Boolean(d.meetingLink), {
    message: 'validation.roomOrMeetingLink',
    path: ['room'],
  });

const scoreValueSchema = coerceNumberFromArabic(z.number().min(0).max(100));

export const scoresSchema = z
  .object({
    teamScores: z.record(z.string().min(1), scoreValueSchema).default({}),
    individualScores: z.record(objectIdSchema, z.record(z.string().min(1), scoreValueSchema)).default({}),
    submit: z.boolean().default(false),
  })
  .strict();

export const defenseTransitionSchema = z
  .object({
    event: z.enum(['OPEN_GRADING', 'UNLOCK_FOR_REVISION', 'FINALIZE'], {
      message: 'validation.invalidEnum',
    }),
    note: z.string().trim().max(1500, 'validation.maxLength').optional(),
  })
  .strict();

export const defenseMinutesSchema = z
  .object({
    minutes: z.string().trim().min(5, 'validation.minLength').max(5000, 'validation.maxLength'),
    recommendations: z.string().trim().max(3000, 'validation.maxLength').optional(),
    modifications: z
      .object({
        required: z.boolean().default(false),
        description: z.string().trim().max(2000).optional(),
        deadline: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const reevaluationRequestSchema = z
  .object({
    studentId: objectIdSchema.optional(),
    reason: z.string().trim().min(10, 'validation.minLength').max(1500, 'validation.maxLength'),
  })
  .strict();

export const decideReevaluationSchema = z
  .object({
    decision: z.enum(['approve', 'reject'], { message: 'validation.invalidEnum' }),
    note: z.string().trim().min(3, 'validation.minLength').max(1000, 'validation.maxLength'),
    replacementCommittee: committeeSchema.optional(),
  })
  .strict();
