import { z } from 'zod';
import {
  MAX_KEYWORDS,
  PROJECT_FIELD_VALUES,
  PROJECT_TYPE_VALUES,
  PROPOSAL_STATUS_VALUES,
} from '../constants/index.js';
import {
  cloudinaryUploadResultSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.js';

export const PROPOSAL_EVENTS = Object.freeze([
  'SUBMIT',
  'START_REVIEW',
  'REQUEST_CHANGES',
  'RESUBMIT',
  'RECOMMEND',
  'APPROVE',
  'REJECT',
  'RETURN',
  'WITHDRAW',
]);

export const createProposalSchema = z
  .object({
    title: z.string().trim().min(5, 'validation.minLength').max(200, 'validation.maxLength'),
    idea: z.string().trim().min(10, 'validation.minLength').max(3000, 'validation.maxLength'),
    problem: z.string().trim().min(10, 'validation.minLength').max(3000, 'validation.maxLength'),
    objectives: z.array(z.string().trim().min(3).max(400)).min(1, 'validation.minItems').max(15),
    scope: z.string().trim().min(5, 'validation.minLength').max(2000, 'validation.maxLength'),
    field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }),
    type: z.enum(PROJECT_TYPE_VALUES, { message: 'validation.invalidEnum' }),
    beneficiaries: z.string().trim().min(3, 'validation.minLength').max(500, 'validation.maxLength'),
    keywords: z.array(z.string().trim().min(2).max(50)).max(MAX_KEYWORDS, 'validation.maxItems').default([]),
    expectedOutcomes: z.string().trim().min(5, 'validation.minLength').max(2000, 'validation.maxLength'),
    cover: cloudinaryUploadResultSchema.optional(),
    preferredSupervisorId: objectIdSchema.optional(),
    ideaId: objectIdSchema.optional(),
  })
  .strict();

export const updateProposalSchema = createProposalSchema.partial().strict();

export const listProjectsQuerySchema = paginationQuerySchema.extend({
  academicYearId: objectIdSchema.optional(),
  collegeId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  status: z.enum(PROPOSAL_STATUS_VALUES, { message: 'validation.invalidEnum' }).optional(),
  supervisorId: objectIdSchema.optional(),
  field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }).optional(),
  type: z.enum(PROJECT_TYPE_VALUES, { message: 'validation.invalidEnum' }).optional(),
  q: z.string().trim().max(120).optional(),
});

export const transitionProposalSchema = z
  .object({
    event: z.enum(PROPOSAL_EVENTS, { message: 'validation.invalidEnum' }),
    comment: z.string().trim().max(1500, 'validation.maxLength').optional(),
  })
  .strict();

export const teamInviteSchema = z
  .object({
    inviteeId: objectIdSchema.optional(),
    link: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Boolean(val.inviteeId) !== Boolean(val.link), {
    message: 'validation.required',
  });

export const assignSupervisionSchema = z
  .object({
    primaryId: objectIdSchema.nullable().optional(),
    coSupervisorIds: z.array(objectIdSchema).max(5).default([]),
    mentorIds: z.array(objectIdSchema).max(5).default([]),
    reviewerId: objectIdSchema.nullable().optional(),
    overrideReason: z.string().trim().min(5, 'validation.minLength').max(500).optional(),
  })
  .strict();

export const createIdeaSchema = z
  .object({
    title: z.string().trim().min(5, 'validation.minLength').max(200, 'validation.maxLength'),
    description: z.string().trim().min(10, 'validation.minLength').max(3000, 'validation.maxLength'),
    field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }),
    type: z.enum(PROJECT_TYPE_VALUES, { message: 'validation.invalidEnum' }),
    collegeId: objectIdSchema.optional(),
  })
  .strict();

export const updateIdeaSchema = createIdeaSchema.partial().strict();
