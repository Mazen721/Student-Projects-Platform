import { z } from 'zod';
import {
  DEFAULT_GRADE_SPREAD_THRESHOLD,
  DEFAULT_MIN_VOTE_ACCOUNT_AGE_HOURS,
  DEFAULT_PASS_MARK,
  DEFAULT_REEVAL_WINDOW_DAYS,
  DEFAULT_SUPERVISOR_PRIMARY_CAP,
  DEFAULT_VOTE_BURST_PER_IP_10M,
  MAX_UPLOAD_BYTES,
  ORG_STATUS_VALUES,
  TEAM_SIZE_MAX_BOUND,
  TEAM_SIZE_MIN_BOUND,
} from '../constants/index.js';
import { emailSchema, nameSchema } from './auth.js';
import { coerceNumberFromArabic, objectIdSchema, paginationQuerySchema } from './common.js';

export const universitySettingsSchema = z
  .object({
    allowedEmailDomains: z
      .array(z.string().trim().toLowerCase().min(3, 'validation.minLength'))
      .min(1, 'validation.minItems')
      .optional(),
    minVoteAccountAgeHours: coerceNumberFromArabic(
      z.number().int().min(0).max(720).default(DEFAULT_MIN_VOTE_ACCOUNT_AGE_HOURS)
    ).optional(),
    voteBurstPerIp10m: coerceNumberFromArabic(
      z.number().int().min(1).max(1000).default(DEFAULT_VOTE_BURST_PER_IP_10M)
    ).optional(),
  })
  .strict();

export const createCollegeSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    code: z.string().trim().min(2, 'validation.minLength').max(20, 'validation.maxLength'),
  })
  .strict();

export const updateCollegeSchema = createCollegeSchema.partial().strict();

export const collegeSettingsSchema = z
  .object({
    teamSizeMin: coerceNumberFromArabic(
      z.number().int().min(TEAM_SIZE_MIN_BOUND).max(TEAM_SIZE_MAX_BOUND)
    ).optional(),
    teamSizeMax: coerceNumberFromArabic(
      z.number().int().min(TEAM_SIZE_MIN_BOUND).max(TEAM_SIZE_MAX_BOUND)
    ).optional(),
    allowCrossCollege: z.boolean().optional(),
    supervisorPrimaryCap: coerceNumberFromArabic(
      z.number().int().min(1).max(50).default(DEFAULT_SUPERVISOR_PRIMARY_CAP)
    ).optional(),
    passMark: coerceNumberFromArabic(
      z.number().min(0).max(100).default(DEFAULT_PASS_MARK)
    ).optional(),
    gradeSpreadThreshold: coerceNumberFromArabic(
      z.number().min(1).max(100).default(DEFAULT_GRADE_SPREAD_THRESHOLD)
    ).optional(),
    reevaluationWindowDays: coerceNumberFromArabic(
      z.number().int().min(0).max(90).default(DEFAULT_REEVAL_WINDOW_DAYS)
    ).optional(),
    uploadLimits: z
      .object({
        maxBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (data) => data.teamSizeMin === undefined || data.teamSizeMax === undefined || data.teamSizeMax >= data.teamSizeMin,
    { message: 'validation.teamSizeOrder', path: ['teamSizeMax'] }
  );

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
    code: z.string().trim().min(2, 'validation.minLength').max(20, 'validation.maxLength'),
  })
  .strict();

export const updateDepartmentSchema = createDepartmentSchema.partial().strict();

const isoDateSchema = z.coerce.date({ invalid_type_error: 'validation.invalidDate' });

const semesterSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.minLength').max(80, 'validation.maxLength'),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .strict()
  .refine((sem) => sem.endDate > sem.startDate, {
    message: 'validation.dateOrder',
    path: ['endDate'],
  });

export const academicYearSchema = z
  .object({
    label: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'validation.yearLabelFormat'),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    semesters: z.array(semesterSchema).max(4).optional(),
    cycle: z
      .object({
        registrationOpensAt: isoDateSchema,
        registrationClosesAt: isoDateSchema,
        proposalDeadline: isoDateSchema,
        defenseStart: isoDateSchema.optional(),
        defenseEnd: isoDateSchema.optional(),
      })
      .strict()
      .refine((c) => c.registrationClosesAt > c.registrationOpensAt, {
        message: 'validation.dateOrder',
        path: ['registrationClosesAt'],
      })
      .refine((c) => c.proposalDeadline >= c.registrationClosesAt, {
        message: 'validation.dateOrder',
        path: ['proposalDeadline'],
      })
      .refine((c) => !c.defenseStart || !c.defenseEnd || c.defenseEnd >= c.defenseStart, {
        message: 'validation.dateOrder',
        path: ['defenseEnd'],
      }),
  })
  .strict()
  .refine((ay) => ay.endDate > ay.startDate, {
    message: 'validation.dateOrder',
    path: ['endDate'],
  });

export const updateAcademicYearSchema = academicYearSchema.innerType().partial().strict();

export const listCollegesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORG_STATUS_VALUES, { message: 'validation.invalidEnum' }).optional(),
});

export const importStudentRowSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    studentId: z.string().trim().min(3, 'validation.minLength').max(32, 'validation.maxLength'),
    departmentCode: z.string().trim().min(1, 'validation.required').max(20),
  })
  .strict();

export const importSupervisorRowSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    departmentCode: z.string().trim().min(1, 'validation.required').max(20),
  })
  .strict();

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(80).optional(),
  actorId: objectIdSchema.optional(),
  targetType: z.string().trim().max(60).optional(),
  targetId: objectIdSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
