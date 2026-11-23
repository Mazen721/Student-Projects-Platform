import { z } from 'zod';
import {
  MAX_PUBLIC_COMMENT_LENGTH,
  PROJECT_FIELD_VALUES,
  PROJECT_TYPE_VALUES,
  SHOWCASE_TEMPLATE_VALUES,
  SHOWCASE_THEME_VALUES,
  VOTER_RESTRICTION_VALUES,
} from '../constants/index.js';
import {
  cloudinaryUploadResultSchema,
  linkRefSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.js';

export const SHOWCASE_EVENTS = Object.freeze([
  'REQUEST_PUBLISH',
  'APPROVE',
  'REJECT_PUBLISH',
  'UNPUBLISH',
  'PUBLISH',
  'TAKE_DOWN',
]);

export const showcasePageSchema = z
  .object({
    template: z.enum(SHOWCASE_TEMPLATE_VALUES, { message: 'validation.invalidEnum' }),
    theme: z.enum(SHOWCASE_THEME_VALUES, { message: 'validation.invalidEnum' }),
    sections: z
      .object({
        hero: z
          .object({
            slogan: z.string().trim().max(200).optional(),
            cover: cloudinaryUploadResultSchema.optional(),
          })
          .strict()
          .optional(),
        problem: z.string().trim().max(3000).optional(),
        solution: z.string().trim().max(3000).optional(),
        features: z.array(z.string().trim().min(2).max(300)).max(20).optional(),
        technologies: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        components: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
        video: linkRefSchema.optional(),
        achievements: z.array(z.string().trim().min(2).max(300)).max(15).optional(),
        interest: z.string().trim().max(1000).optional(),
      })
      .strict(),
    hiddenSections: z.array(z.string().trim().max(40)).max(15).default([]),
  })
  .strict();

export const showcaseTransitionSchema = z
  .object({
    event: z.enum(SHOWCASE_EVENTS, { message: 'validation.invalidEnum' }),
    reason: z.string().trim().max(1000, 'validation.maxLength').optional(),
  })
  .strict();

export const competitionSchema = z
  .object({
    title: z.string().trim().min(3, 'validation.minLength').max(150, 'validation.maxLength'),
    scopeType: z.enum(['university', 'college'], { message: 'validation.invalidEnum' }),
    scopeId: objectIdSchema.optional(),
    eligibleProjectIds: z.array(objectIdSchema).max(200).optional(),
    voterRestriction: z.enum(VOTER_RESTRICTION_VALUES, { message: 'validation.invalidEnum' }).default('all'),
    startsAt: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
    endsAt: z.coerce.date({ invalid_type_error: 'validation.invalidDate' }),
  })
  .strict()
  .refine((c) => c.endsAt > c.startsAt, {
    message: 'validation.dateOrder',
    path: ['endsAt'],
  });

export const contactRequestCreateSchema = z
  .object({
    message: z.string().trim().min(10, 'validation.minLength').max(1500, 'validation.maxLength'),
  })
  .strict();

export const contactRequestDecideSchema = z
  .object({
    decision: z.enum(['accept', 'decline'], { message: 'validation.invalidEnum' }),
    reply: z
      .object({
        text: z.string().trim().min(2, 'validation.minLength').max(1500),
        sharedContacts: z
          .object({
            email: z.string().trim().email('validation.invalidEmail').optional(),
            phone: z.string().trim().max(30).optional(),
            other: z.string().trim().max(200).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const challengeSchema = z
  .object({
    title: z.string().trim().min(5, 'validation.minLength').max(180, 'validation.maxLength'),
    description: z.string().trim().min(10, 'validation.minLength').max(3000, 'validation.maxLength'),
    field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }),
  })
  .strict();

export const publicCommentSchema = z
  .object({
    text: z.string().trim().min(2, 'validation.minLength').max(MAX_PUBLIC_COMMENT_LENGTH, 'validation.maxLength'),
    parentId: objectIdSchema.optional(),
  })
  .strict();

export const moderatePublicCommentSchema = z
  .object({
    action: z.enum(['hide', 'remove', 'restore'], { message: 'validation.invalidEnum' }),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listPublicProjectsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  collegeId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }).optional(),
  type: z.enum(PROJECT_TYPE_VALUES, { message: 'validation.invalidEnum' }).optional(),
  academicYearId: objectIdSchema.optional(),
  sort: z.enum(['trending', 'votes', 'recent'], { message: 'validation.invalidEnum' }).default('trending'),
});
