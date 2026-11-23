import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS } from '../../core/auth/tokens.js';
import * as authService from './auth.service.js';

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent') || '',
    ip: req.ip,
  };
}

function actorContext(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function registerStudentHandler(req, res, next) {
  try {
    const result = await authService.registerStudent(req.body, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

export async function registerInvestorHandler(req, res, next) {
  try {
    const result = await authService.registerInvestor(req.body, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

export async function registerVisitorHandler(req, res, next) {
  try {
    const result = await authService.registerVisitor(req.body, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const result = await authService.loginUser(req.body, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
        mustChangePassword: result.mustChangePassword,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const result = await authService.changePassword(req.user.id, req.body, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req, res, next) {
  try {
    const data = await authService.getCurrentUserProfile(req.user.id, req.get('x-role-context'));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getMyProfileHandler(req, res, next) {
  try {
    const user = await authService.getUserProfileById(req.user.id, req.user);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfileHandler(req, res, next) {
  try {
    const user = await authService.updateMyProfile(req.user.id, req.body);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function getUserByIdHandler(req, res, next) {
  try {
    const user = await authService.getUserProfileById(req.params.id, req.user);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function listUsersHandler(req, res, next) {
  try {
    const { items, page } = await authService.listUsers(req.scopeFilter, req.query);
    res.status(200).json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function searchUsersHandler(req, res, next) {
  try {
    const items = await authService.searchUsersForTeam(req.query);
    res.status(200).json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function deactivateUserHandler(req, res, next) {
  try {
    const user = await authService.deactivateUser(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUserHandler(req, res, next) {
  try {
    const user = await authService.reactivateUser(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const result = await authService.resetUserPassword(req.params.id, actorContext(req));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function assignRoleHandler(req, res, next) {
  try {
    const user = await authService.assignUserRole(req.params.id, req.body, actorContext(req));
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function revokeRoleHandler(req, res, next) {
  try {
    await authService.revokeUserRole(req.params.id, req.params.assignmentId, req.body, actorContext(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createInvitationHandler(req, res, next) {
  try {
    const inv = await authService.createRoleInvitation(req.body, actorContext(req));
    res.status(201).json({ data: inv });
  } catch (err) {
    next(err);
  }
}

export async function getInvitationPreviewHandler(req, res, next) {
  try {
    const inv = await authService.getInvitationPreview(req.params.token);
    res.status(200).json({ data: inv });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitationHandler(req, res, next) {
  try {
    const result = await authService.acceptRoleInvitation(req.params.token, req.body, {
      authHeader: req.headers.authorization,
      ...requestMeta(req),
    });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitationHandler(req, res, next) {
  try {
    const result = await authService.revokeInvitation(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function listPendingInvestorsHandler(req, res, next) {
  try {
    const { items, page } = await authService.listPendingInvestors(req.query);
    res.status(200).json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function approveInvestorHandler(req, res, next) {
  try {
    const user = await authService.reviewInvestor(req.params.id, 'approve', req.body, actorContext(req));
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function rejectInvestorHandler(req, res, next) {
  try {
    const user = await authService.reviewInvestor(req.params.id, 'reject', req.body, actorContext(req));
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}
