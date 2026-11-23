import * as ideasService from './ideas.service.js';
import * as proposalService from './proposal.service.js';
import * as supervisionService from './supervision.service.js';
import * as teamService from './team.service.js';

function actorMeta(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function listProjectsHandler(req, res, next) {
  try {
    const result = await proposalService.listProjects(req.scopeFilter, req.query);
    res.json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function getSimilarTitlesHandler(req, res, next) {
  try {
    const matches = await proposalService.getSimilarTitles(req.query);
    res.json({ data: matches });
  } catch (err) {
    next(err);
  }
}

export async function createProposalHandler(req, res, next) {
  try {
    const project = await proposalService.createProposal(req.body, actorMeta(req));
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectHandler(req, res, next) {
  try {
    const project = await proposalService.getProjectById(req.params.id);
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectSummaryHandler(req, res, next) {
  try {
    const summary = await proposalService.getProjectSummary(req.params.id);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

export async function updateProposalHandler(req, res, next) {
  try {
    const project = await proposalService.updateProposal(req.params.id, req.body, actorMeta(req));
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function transitionProposalHandler(req, res, next) {
  try {
    const project = await proposalService.transitionProposal(req.params.id, req.body, actorMeta(req));
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectHistoryHandler(req, res, next) {
  try {
    const data = await proposalService.getProjectHistory(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getProposalVersionHandler(req, res, next) {
  try {
    const data = await proposalService.getProposalVersion(req.params.id, req.params.version);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function inviteTeammateHandler(req, res, next) {
  try {
    const inv = await teamService.inviteTeammate(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data: inv });
  } catch (err) {
    next(err);
  }
}

export async function listMyTeamInvitationsHandler(req, res, next) {
  try {
    const items = await teamService.listMyTeamInvitations(req.user.id);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function acceptTeamInvitationHandler(req, res, next) {
  try {
    const data = await teamService.respondTeamInvitation(req.params.id, 'accept', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function declineTeamInvitationHandler(req, res, next) {
  try {
    const data = await teamService.respondTeamInvitation(req.params.id, 'decline', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeTeamMemberHandler(req, res, next) {
  try {
    const project = await teamService.removeTeamMember(
      req.params.id,
      req.params.userId,
      req.body || {},
      actorMeta(req)
    );
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function leaveTeamHandler(req, res, next) {
  try {
    const project = await teamService.leaveTeam(req.params.id, actorMeta(req));
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function moveTeamMemberHandler(req, res, next) {
  try {
    const data = await teamService.moveTeamMember(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function requestLeadershipTransferHandler(req, res, next) {
  try {
    const data = await teamService.requestLeadershipTransfer(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function acceptLeadershipTransferHandler(req, res, next) {
  try {
    const data = await teamService.respondLeadershipTransfer(req.params.id, 'accept', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function declineLeadershipTransferHandler(req, res, next) {
  try {
    const data = await teamService.respondLeadershipTransfer(req.params.id, 'decline', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function assignSupervisionHandler(req, res, next) {
  try {
    const data = await supervisionService.assignSupervision(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getSupervisorsLoadHandler(req, res, next) {
  try {
    const data = await supervisionService.getSupervisorsLoad(req.scopeFilter, req.query);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listIdeasHandler(req, res, next) {
  try {
    const result = await ideasService.listIdeas(req.scopeFilter, req.query);
    res.json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function createIdeaHandler(req, res, next) {
  try {
    const data = await ideasService.createIdea(req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateIdeaHandler(req, res, next) {
  try {
    const data = await ideasService.updateIdea(req.params.id, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeIdeaHandler(req, res, next) {
  try {
    const data = await ideasService.removeIdea(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function requestIdeaAdoptionHandler(req, res, next) {
  try {
    const data = await ideasService.requestIdeaAdoption(req.params.id, req.body || {}, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listMyIdeasAdoptionRequestsHandler(req, res, next) {
  try {
    const data = await ideasService.listMyIdeasAdoptionRequests(req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function acceptAdoptionRequestHandler(req, res, next) {
  try {
    const data = await ideasService.decideAdoptionRequest(req.params.id, 'accept', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function declineAdoptionRequestHandler(req, res, next) {
  try {
    const data = await ideasService.decideAdoptionRequest(req.params.id, 'decline', actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
