import { z } from 'zod';
import {
  MAX_BIO_LENGTH,
  MAX_SKILLS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PRIVACY_VALUES,
  ROLES,
  ROLE_VALUES,
  SCOPE_TYPE_VALUES,
  USER_STATUS_VALUES,
} from '../constants/index.js';
import {
  cloudinaryUploadResultSchema,
  httpsUrlSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.js';

export const emailSchema = z
  .string({ required_error: 'validation.required', invalid_type_error: 'validation.invalidString' })
  .trim()
  .toLowerCase()
  .email('validation.invalidEmail')
  .max(254, 'validation.maxLength');

export const passwordSchema = z
  .string({ required_error: 'validation.required', invalid_type_error: 'validation.invalidString' })
  .min(PASSWORD_MIN_LENGTH, 'validation.invalidPassword')
  .max(PASSWORD_MAX_LENGTH, 'validation.invalidPassword')
  .refine((val) => /[A-Za-z\u0621-\u064A]/.test(val) && /\d/.test(val), {
    message: 'validation.invalidPassword',
  });

export const nameSchema = z
  .string({ required_error: 'validation.required', invalid_type_error: 'validation.invalidString' })
  .trim()
  .min(2, 'validation.minLength')
  .max(100, 'validation.maxLength');

export const registerStudentSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    studentId: z.string().trim().min(3, 'validation.minLength').max(32, 'validation.maxLength'),
    password: passwordSchema,
    collegeId: objectIdSchema,
    departmentId: objectIdSchema,
  })
  .strict();

export const registerInvestorSchema = z
  .object({
    name: nameSchema,
    organization: z.string().trim().min(2, 'validation.minLength').max(150, 'validation.maxLength'),
    email: emailSchema,
    password: passwordSchema,
    fieldOfInterest: z.string().trim().min(2, 'validation.minLength').max(150, 'validation.maxLength'),
  })
  .strict();

export const registerVisitorSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'validation.required').max(PASSWORD_MAX_LENGTH, 'validation.maxLength'),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required').max(PASSWORD_MAX_LENGTH).optional(),
    newPassword: passwordSchema,
  })
  .strict();

export const acceptInviteSchema = z
  .object({
    name: nameSchema.optional(),
    password: passwordSchema.optional(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    bio: z.string().trim().max(MAX_BIO_LENGTH, 'validation.maxLength').optional(),
    skills: z.array(z.string().trim().min(1).max(50)).max(MAX_SKILLS, 'validation.maxItems').optional(),
    phone: z.string().trim().max(30, 'validation.maxLength').optional(),
    socialLinks: z.array(httpsUrlSchema).max(5, 'validation.maxItems').optional(),
    avatar: cloudinaryUploadResultSchema.optional(),
    privacy: z
      .object({
        email: z.enum(PRIVACY_VALUES, { message: 'validation.invalidEnum' }).optional(),
        phone: z.enum(PRIVACY_VALUES, { message: 'validation.invalidEnum' }).optional(),
        socialLinks: z.enum(PRIVACY_VALUES, { message: 'validation.invalidEnum' }).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_VALUES, { message: 'validation.invalidEnum' }).optional(),
  collegeId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  status: z.enum(USER_STATUS_VALUES, { message: 'validation.invalidEnum' }).optional(),
});

export const assignRoleSchema = z
  .object({
    role: z.enum(ROLE_VALUES, { message: 'validation.invalidEnum' }),
    scopeType: z.enum(SCOPE_TYPE_VALUES, { message: 'validation.invalidEnum' }),
    scopeId: objectIdSchema.optional(),
  })
  .strict();

export const createInvitationSchema = z
  .object({
    role: z.enum(
      [ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.SUPERVISOR, ROLES.UNIVERSITY_ADMIN],
      { message: 'validation.invalidEnum' }
    ),
    scopeType: z.enum(SCOPE_TYPE_VALUES, { message: 'validation.invalidEnum' }),
    scopeId: objectIdSchema.optional(),
  })
  .strict();
