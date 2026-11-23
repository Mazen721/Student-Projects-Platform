import { z } from 'zod';
import {
  IDEA_STATUS_VALUES,
  PROJECT_FIELD_VALUES,
  PROJECT_TYPE_VALUES,
} from '@spp/shared/constants';
import {
  assignSupervisionSchema,
  coerceNumberFromArabic,
  createIdeaSchema,
  createProposalSchema,
  listProjectsQuerySchema,
  objectIdSchema,
  paginationQuerySchema,
  reasonBodySchema,
  teamInviteSchema,
  transitionProposalSchema,
  updateIdeaSchema,
  updateProposalSchema,
} from '@spp/shared/schemas';

export const idParamSchema = z.object({ id: objectIdSchema });
export const memberParamSchema = z.object({ id: objectIdSchema, userId: objectIdSchema });
export const versionParamSchema = z.object({
  id: objectIdSchema,
  version: coerceNumberFromArabic(z.number().int().min(1)),
});

export const similarTitlesQuerySchema = z.object({
  title: z.string().trim().min(2, 'validation.minLength').max(200),
  excludeId: objectIdSchema.optional(),
});

export const respondInviteBodySchema = z
  .object({
    token: z.string().trim().min(10).max(200).optional(),
  })
  .strict();

export const removeMemberBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const moveMemberBodySchema = z
  .object({
    userId: objectIdSchema,
    targetProjectId: objectIdSchema,
    reason: z.string().trim().min(3, 'validation.minLength').max(500),
  })
  .strict();

export const leadershipTransferBodySchema = z
  .object({
    toUserId: objectIdSchema,
  })
  .strict();

export const supervisorsLoadQuerySchema = z.object({
  academicYearId: objectIdSchema,
  collegeId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
});

export const listIdeasQuerySchema = paginationQuerySchema.extend({
  status: z.enum(IDEA_STATUS_VALUES).optional(),
  field: z.enum(PROJECT_FIELD_VALUES).optional(),
  collegeId: objectIdSchema.optional(),
  ownerKind: z.enum(['supervisor', 'investor']).optional(),
});

export const adoptionRequestBodySchema = z
  .object({
    projectId: objectIdSchema.optional(),
  })
  .strict();

export {
  assignSupervisionSchema,
  createIdeaSchema,
  createProposalSchema,
  listProjectsQuerySchema,
  PROJECT_TYPE_VALUES,
  reasonBodySchema,
  teamInviteSchema,
  transitionProposalSchema,
  updateIdeaSchema,
  updateProposalSchema,
};
