import { Router } from 'express';
import { authorize } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import * as ctrl from './projects.controller.js';
import {
  adoptionRequestBodySchema,
  assignSupervisionSchema,
  createIdeaSchema,
  createProposalSchema,
  idParamSchema,
  leadershipTransferBodySchema,
  listIdeasQuerySchema,
  listProjectsQuerySchema,
  memberParamSchema,
  moveMemberBodySchema,
  reasonBodySchema,
  removeMemberBodySchema,
  respondInviteBodySchema,
  similarTitlesQuerySchema,
  supervisorsLoadQuerySchema,
  teamInviteSchema,
  transitionProposalSchema,
  updateIdeaSchema,
  updateProposalSchema,
  versionParamSchema,
} from './projects.validation.js';

export function createProjectsRouter(limiters) {
  const router = Router();
  const { writeLimiter } = limiters;

  router.get(
    '/projects',
    authorize('project.list', 'scope'),
    validate({ query: listProjectsQuerySchema }),
    ctrl.listProjectsHandler
  );
  router.get(
    '/projects/similar-titles',
    authorize('proposal.create', 'self'),
    validate({ query: similarTitlesQuerySchema }),
    ctrl.getSimilarTitlesHandler
  );
  router.post(
    '/projects',
    authorize('proposal.create', 'self'),
    writeLimiter,
    validate({ body: createProposalSchema }),
    ctrl.createProposalHandler
  );
  router.get(
    '/projects/:id',
    authorize('project.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getProjectHandler
  );
  router.get(
    '/projects/:id/summary',
    authorize('project.readSummary', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getProjectSummaryHandler
  );
  router.patch(
    '/projects/:id',
    authorize('proposal.update', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateProposalSchema }),
    ctrl.updateProposalHandler
  );
  router.post(
    '/projects/:id/transitions',
    authorize('proposal.transition', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: transitionProposalSchema }),
    ctrl.transitionProposalHandler
  );
  router.get(
    '/projects/:id/history',
    authorize('project.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getProjectHistoryHandler
  );
  router.get(
    '/projects/:id/versions/:version',
    authorize('project.read', 'project'),
    validate({ params: versionParamSchema }),
    ctrl.getProposalVersionHandler
  );

  router.post(
    '/projects/:id/team/invitations',
    authorize('team.invite', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: teamInviteSchema }),
    ctrl.inviteTeammateHandler
  );
  router.get(
    '/me/team-invitations',
    authorize('self.read', 'user'),
    ctrl.listMyTeamInvitationsHandler
  );
  router.post(
    '/team-invitations/:id/accept',
    authorize('team.respond', 'teamInvitation'),
    writeLimiter,
    validate({ params: idParamSchema, body: respondInviteBodySchema }),
    ctrl.acceptTeamInvitationHandler
  );
  router.post(
    '/team-invitations/:id/decline',
    authorize('team.respond', 'teamInvitation'),
    writeLimiter,
    validate({ params: idParamSchema, body: respondInviteBodySchema }),
    ctrl.declineTeamInvitationHandler
  );
  router.delete(
    '/projects/:id/team/members/:userId',
    authorize('team.removeMember', 'project'),
    writeLimiter,
    validate({ params: memberParamSchema, body: removeMemberBodySchema }),
    ctrl.removeTeamMemberHandler
  );
  router.post(
    '/projects/:id/team/leave',
    authorize('team.leave', 'project'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.leaveTeamHandler
  );
  router.post(
    '/projects/:id/team/move',
    authorize('team.moveMember', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: moveMemberBodySchema }),
    ctrl.moveTeamMemberHandler
  );
  router.post(
    '/projects/:id/leadership-transfer',
    authorize('team.transferLeadership', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: leadershipTransferBodySchema }),
    ctrl.requestLeadershipTransferHandler
  );
  router.post(
    '/leadership-transfers/:id/accept',
    authorize('team.respondTransfer', 'leadershipTransfer'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.acceptLeadershipTransferHandler
  );
  router.post(
    '/leadership-transfers/:id/decline',
    authorize('team.respondTransfer', 'leadershipTransfer'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.declineLeadershipTransferHandler
  );

  router.put(
    '/projects/:id/supervision',
    authorize('supervision.assign', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: assignSupervisionSchema }),
    ctrl.assignSupervisionHandler
  );
  router.get(
    '/supervisors/load',
    authorize('supervision.viewLoad', 'scope'),
    validate({ query: supervisorsLoadQuerySchema }),
    ctrl.getSupervisorsLoadHandler
  );

  router.get(
    '/ideas',
    authorize('idea.list', 'scope'),
    validate({ query: listIdeasQuerySchema }),
    ctrl.listIdeasHandler
  );
  router.post(
    '/ideas',
    authorize('idea.create', 'self'),
    writeLimiter,
    validate({ body: createIdeaSchema }),
    ctrl.createIdeaHandler
  );
  router.patch(
    '/ideas/:id',
    authorize('idea.update', 'idea'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateIdeaSchema }),
    ctrl.updateIdeaHandler
  );
  router.post(
    '/ideas/:id/remove',
    authorize('idea.remove', 'idea'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.removeIdeaHandler
  );
  router.post(
    '/ideas/:id/adoption-requests',
    authorize('idea.requestAdoption', 'idea'),
    writeLimiter,
    validate({ params: idParamSchema, body: adoptionRequestBodySchema }),
    ctrl.requestIdeaAdoptionHandler
  );
  router.get(
    '/me/adoption-requests',
    authorize('idea.create', 'self'),
    ctrl.listMyIdeasAdoptionRequestsHandler
  );
  router.post(
    '/adoption-requests/:id/accept',
    authorize('idea.decideAdoption', 'adoptionRequest'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.acceptAdoptionRequestHandler
  );
  router.post(
    '/adoption-requests/:id/decline',
    authorize('idea.decideAdoption', 'adoptionRequest'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.declineAdoptionRequestHandler
  );

  return router;
}
