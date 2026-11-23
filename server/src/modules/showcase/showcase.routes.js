import { Router } from 'express';
import { authorize, publicRoute } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import * as ctrl from './showcase.controller.js';
import {
  challengeSchema,
  competitionSchema,
  competitionVoteParamsSchema,
  contactRequestCreateSchema,
  contactRequestDecideSchema,
  featuredProjectsSchema,
  idParamSchema,
  listChallengesQuerySchema,
  listCollegeShowcaseQuerySchema,
  listPublicProjectsQuerySchema,
  moderatePublicCommentSchema,
  paginationQuerySchema,
  publicCommentSchema,
  reasonBodySchema,
  reviewVoteSchema,
  showcasePageSchema,
  showcaseTransitionSchema,
  slugParamSchema,
} from './showcase.validation.js';

export function createShowcaseRouter(limiters) {
  const router = Router();
  const { writeLimiter, voteLimiter } = limiters;

  // Public endpoints
  router.get('/public/home', publicRoute(), ctrl.getPublicHomeHandler);
  router.get(
    '/public/projects',
    publicRoute(),
    validate({ query: listPublicProjectsQuerySchema }),
    ctrl.listPublicProjectsHandler
  );
  router.get(
    '/public/projects/:slug',
    publicRoute(),
    validate({ params: slugParamSchema }),
    ctrl.getPublicProjectDetailHandler
  );
  router.post(
    '/public/projects/:slug/view',
    publicRoute(),
    validate({ params: slugParamSchema }),
    ctrl.recordPublicPageViewHandler
  );
  router.get(
    '/public/colleges/:id/showcase',
    publicRoute(),
    validate({ params: idParamSchema, query: listCollegeShowcaseQuerySchema }),
    ctrl.getPublicCollegeShowcaseHandler
  );
  router.get(
    '/public/projects/:slug/comments',
    publicRoute(),
    validate({ params: slugParamSchema, query: paginationQuerySchema }),
    ctrl.listPublicCommentsHandler
  );
  router.get('/public/competitions', publicRoute(), ctrl.listPublicCompetitionsHandler);
  router.get(
    '/public/competitions/:id',
    publicRoute(),
    validate({ params: idParamSchema }),
    ctrl.getPublicCompetitionHandler
  );

  // Team showcase management & featured
  router.get(
    '/projects/:id/showcase',
    authorize('showcase.edit', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getTeamShowcaseHandler
  );
  router.put(
    '/projects/:id/showcase',
    authorize('showcase.edit', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: showcasePageSchema }),
    ctrl.updateTeamShowcaseHandler
  );
  router.get(
    '/projects/:id/showcase/preview',
    authorize('showcase.edit', 'project'),
    validate({ params: idParamSchema }),
    ctrl.previewTeamShowcaseHandler
  );
  router.post(
    '/projects/:id/showcase/transitions',
    authorize('showcase.transition', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: showcaseTransitionSchema }),
    ctrl.transitionShowcaseHandler
  );
  router.put(
    '/university/featured',
    authorize('showcase.feature', 'university'),
    writeLimiter,
    validate({ body: featuredProjectsSchema }),
    ctrl.setUniversityFeaturedHandler
  );

  // Voting & competitions
  router.post(
    '/projects/:id/vote',
    authorize('vote.cast', 'publishedProject'),
    voteLimiter,
    validate({ params: idParamSchema }),
    ctrl.castVoteHandler
  );
  router.delete(
    '/projects/:id/vote',
    authorize('vote.withdraw', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.withdrawVoteHandler
  );
  router.post(
    '/competitions',
    authorize('competition.create', 'scope'),
    writeLimiter,
    validate({ body: competitionSchema }),
    ctrl.createCompetitionHandler
  );
  router.post(
    '/competitions/:id/projects/:projectId/vote',
    authorize('vote.cast', 'competition'),
    voteLimiter,
    validate({ params: competitionVoteParamsSchema }),
    ctrl.castCompetitionVoteHandler
  );
  router.delete(
    '/competitions/:id/projects/:projectId/vote',
    authorize('vote.withdraw', 'competition'),
    writeLimiter,
    validate({ params: competitionVoteParamsSchema }),
    ctrl.withdrawCompetitionVoteHandler
  );
  router.get(
    '/votes/flagged',
    authorize('vote.review', 'scope'),
    validate({ query: paginationQuerySchema }),
    ctrl.listFlaggedVotesHandler
  );
  router.post(
    '/votes/:id/review',
    authorize('vote.review', 'vote'),
    writeLimiter,
    validate({ params: idParamSchema, body: reviewVoteSchema }),
    ctrl.reviewFlaggedVoteHandler
  );

  // Investors
  router.post(
    '/projects/:id/follow',
    authorize('investor.follow', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.followProjectHandler
  );
  router.delete(
    '/projects/:id/follow',
    authorize('investor.follow', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.unfollowProjectHandler
  );
  router.post(
    '/projects/:id/bookmark',
    authorize('investor.bookmark', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.bookmarkProjectHandler
  );
  router.delete(
    '/projects/:id/bookmark',
    authorize('investor.bookmark', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.unbookmarkProjectHandler
  );
  router.get(
    '/me/follows',
    authorize('self.read', 'user'),
    validate({ query: paginationQuerySchema }),
    ctrl.listMyFollowsHandler
  );
  router.get(
    '/me/bookmarks',
    authorize('self.read', 'user'),
    validate({ query: paginationQuerySchema }),
    ctrl.listMyBookmarksHandler
  );
  router.post(
    '/projects/:id/contact-requests',
    authorize('contact.request', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema, body: contactRequestCreateSchema }),
    ctrl.createContactRequestHandler
  );
  router.get(
    '/projects/:id/contact-requests',
    authorize('contact.list', 'project'),
    validate({ params: idParamSchema, query: paginationQuerySchema }),
    ctrl.listProjectContactRequestsHandler
  );
  router.post(
    '/contact-requests/:id/decide',
    authorize('contact.decide', 'contactRequest'),
    writeLimiter,
    validate({ params: idParamSchema, body: contactRequestDecideSchema }),
    ctrl.decideContactRequestHandler
  );
  router.get(
    '/me/contact-requests',
    authorize('self.read', 'user'),
    validate({ query: paginationQuerySchema }),
    ctrl.listMyContactRequestsHandler
  );
  router.get(
    '/challenges',
    authorize('challenge.list', 'self'),
    validate({ query: listChallengesQuerySchema }),
    ctrl.listChallengesHandler
  );
  router.post(
    '/challenges',
    authorize('challenge.create', 'self'),
    writeLimiter,
    validate({ body: challengeSchema }),
    ctrl.createChallengeHandler
  );
  router.post(
    '/challenges/:id/remove',
    authorize('challenge.remove', 'challenge'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.removeChallengeHandler
  );

  // Public comments
  router.post(
    '/projects/:id/public-comments',
    authorize('publicComment.create', 'publishedProject'),
    writeLimiter,
    validate({ params: idParamSchema, body: publicCommentSchema }),
    ctrl.createPublicCommentHandler
  );
  router.post(
    '/public-comments/:id/report',
    authorize('publicComment.report', 'publicComment'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.reportPublicCommentHandler
  );
  router.post(
    '/public-comments/:id/moderate',
    authorize('publicComment.moderate', 'publicComment'),
    writeLimiter,
    validate({ params: idParamSchema, body: moderatePublicCommentSchema }),
    ctrl.moderatePublicCommentHandler
  );

  return router;
}
