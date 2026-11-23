import { z } from 'zod';
import { PROJECT_FIELD_VALUES } from '@spp/shared/constants';
import {
  challengeSchema,
  competitionSchema,
  contactRequestCreateSchema,
  contactRequestDecideSchema,
  listPublicProjectsQuerySchema,
  moderatePublicCommentSchema,
  objectIdSchema,
  paginationQuerySchema,
  publicCommentSchema,
  showcasePageSchema,
  showcaseTransitionSchema,
} from '@spp/shared/schemas';

export {
  challengeSchema,
  competitionSchema,
  contactRequestCreateSchema,
  contactRequestDecideSchema,
  listPublicProjectsQuerySchema,
  moderatePublicCommentSchema,
  paginationQuerySchema,
  publicCommentSchema,
  showcasePageSchema,
  showcaseTransitionSchema,
};

export const idParamSchema = z.object({ id: objectIdSchema });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(220) });

export const competitionVoteParamsSchema = z.object({
  id: objectIdSchema,
  projectId: objectIdSchema,
});

export const featuredProjectsSchema = z
  .object({
    projectIds: z.array(objectIdSchema).max(20),
  })
  .strict();

export const reviewVoteSchema = z
  .object({
    decision: z.enum(['clear', 'reject'], { message: 'validation.invalidEnum' }),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const reasonBodySchema = z
  .object({
    reason: z.string().trim().min(2, 'validation.minLength').max(500, 'validation.maxLength'),
  })
  .strict();

export const listChallengesQuerySchema = paginationQuerySchema.extend({
  field: z.enum(PROJECT_FIELD_VALUES, { message: 'validation.invalidEnum' }).optional(),
});

export const listCollegeShowcaseQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['trending', 'votes', 'recent'], { message: 'validation.invalidEnum' }).default('trending'),
});
