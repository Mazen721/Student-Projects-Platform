import * as commentsService from './comments.service.js';
import * as investorService from './investor.service.js';
import * as showcaseService from './showcase.service.js';
import * as votingService from './voting.service.js';

function actorContext(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function getPublicHomeHandler(_req, res, next) {
  try {
    const data = await showcaseService.getPublicHome();
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listPublicProjectsHandler(req, res, next) {
  try {
    const result = await showcaseService.listPublicProjects(req.query);
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProjectDetailHandler(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = await showcaseService.getPublicProjectDetail(req.params.slug, {
      authHeader: req.headers.authorization,
    });
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function recordPublicPageViewHandler(req, res, next) {
  try {
    await showcaseService.recordPublicPageView(req.params.slug, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getPublicCollegeShowcaseHandler(req, res, next) {
  try {
    const result = await showcaseService.getPublicCollegeShowcase(req.params.id, req.query);
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({
      data: { college: result.college, items: result.items },
      page: result.page,
    });
  } catch (err) {
    next(err);
  }
}

export async function listPublicCommentsHandler(req, res, next) {
  try {
    const result = await commentsService.listPublicComments(req.params.slug, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function listPublicCompetitionsHandler(_req, res, next) {
  try {
    const data = await votingService.listPublicCompetitions();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getPublicCompetitionHandler(req, res, next) {
  try {
    const data = await votingService.getPublicCompetitionById(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getTeamShowcaseHandler(req, res, next) {
  try {
    const data = await showcaseService.getTeamShowcasePage(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateTeamShowcaseHandler(req, res, next) {
  try {
    const data = await showcaseService.updateTeamShowcasePage(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function previewTeamShowcaseHandler(req, res, next) {
  try {
    const data = await showcaseService.previewTeamShowcasePage(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function transitionShowcaseHandler(req, res, next) {
  try {
    const data = await showcaseService.transitionShowcasePage(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function setUniversityFeaturedHandler(req, res, next) {
  try {
    const data = await showcaseService.setUniversityFeatured(
      req.body.projectIds,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function castVoteHandler(req, res, next) {
  try {
    const data = await votingService.castVote(req.params.id, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function withdrawVoteHandler(req, res, next) {
  try {
    await votingService.withdrawVote(req.params.id, actorContext(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createCompetitionHandler(req, res, next) {
  try {
    const data = await votingService.createCompetition(req.body, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function castCompetitionVoteHandler(req, res, next) {
  try {
    const data = await votingService.castCompetitionVote(
      req.params.id,
      req.params.projectId,
      actorContext(req)
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function withdrawCompetitionVoteHandler(req, res, next) {
  try {
    await votingService.withdrawCompetitionVote(
      req.params.id,
      req.params.projectId,
      actorContext(req)
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listFlaggedVotesHandler(req, res, next) {
  try {
    const result = await votingService.listFlaggedVotes(req.scopeFilter || {}, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function reviewFlaggedVoteHandler(req, res, next) {
  try {
    const data = await votingService.reviewFlaggedVote(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function followProjectHandler(req, res, next) {
  try {
    const data = await investorService.followProject(req.params.id, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function unfollowProjectHandler(req, res, next) {
  try {
    await investorService.unfollowProject(req.params.id, actorContext(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function bookmarkProjectHandler(req, res, next) {
  try {
    const data = await investorService.bookmarkProject(req.params.id, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function unbookmarkProjectHandler(req, res, next) {
  try {
    await investorService.unbookmarkProject(req.params.id, actorContext(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listMyFollowsHandler(req, res, next) {
  try {
    const result = await investorService.listMyFollows(req.user.id, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function listMyBookmarksHandler(req, res, next) {
  try {
    const result = await investorService.listMyBookmarks(req.user.id, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function createContactRequestHandler(req, res, next) {
  try {
    const data = await investorService.createContactRequest(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listProjectContactRequestsHandler(req, res, next) {
  try {
    const result = await investorService.listProjectContactRequests(req.params.id, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function decideContactRequestHandler(req, res, next) {
  try {
    const data = await investorService.decideContactRequest(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listMyContactRequestsHandler(req, res, next) {
  try {
    const result = await investorService.listMyContactRequests(req.user.id, req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function listChallengesHandler(req, res, next) {
  try {
    const result = await investorService.listChallenges(req.query);
    res.status(200).json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function createChallengeHandler(req, res, next) {
  try {
    const data = await investorService.createChallenge(req.body, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeChallengeHandler(req, res, next) {
  try {
    const data = await investorService.removeChallenge(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createPublicCommentHandler(req, res, next) {
  try {
    const data = await commentsService.createPublicComment(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reportPublicCommentHandler(req, res, next) {
  try {
    const data = await commentsService.reportPublicComment(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function moderatePublicCommentHandler(req, res, next) {
  try {
    const data = await commentsService.moderatePublicComment(
      req.params.id,
      req.body,
      actorContext(req)
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
