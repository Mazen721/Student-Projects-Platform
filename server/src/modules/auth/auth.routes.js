import { Router } from 'express';
import { authorize, publicRoute } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import * as ctrl from './auth.controller.js';
import {
  acceptInviteSchema,
  assignRoleSchema,
  changePasswordSchema,
  createInvitationSchema,
  deactivateUserSchema,
  idParamSchema,
  inviteTokenParamSchema,
  listUsersQuerySchema,
  loginSchema,
  paginationQuerySchema,
  reasonOptionalSchema,
  reasonRequiredSchema,
  registerInvestorSchema,
  registerStudentSchema,
  registerVisitorSchema,
  roleRevokeParamSchema,
  searchUsersQuerySchema,
  updateProfileSchema,
} from './auth.validation.js';

export function createAuthModuleRouter(limiters) {
  const router = Router();
  const { authLimiter, writeLimiter } = limiters;

  router.post(
    '/auth/register/student',
    publicRoute(),
    authLimiter,
    validate({ body: registerStudentSchema }),
    ctrl.registerStudentHandler
  );
  router.post(
    '/auth/register/investor',
    publicRoute(),
    authLimiter,
    validate({ body: registerInvestorSchema }),
    ctrl.registerInvestorHandler
  );
  router.post(
    '/auth/register/visitor',
    publicRoute(),
    authLimiter,
    validate({ body: registerVisitorSchema }),
    ctrl.registerVisitorHandler
  );
  router.post('/auth/login', publicRoute(), authLimiter, validate({ body: loginSchema }), ctrl.loginHandler);
  router.post(
    '/auth/change-password',
    authorize('self.changePassword', 'user'),
    writeLimiter,
    validate({ body: changePasswordSchema }),
    ctrl.changePasswordHandler
  );
  router.get('/auth/me', authorize('self.read', 'user'), ctrl.meHandler);

  router.get(
    '/invitations/:token',
    publicRoute(),
    validate({ params: inviteTokenParamSchema }),
    ctrl.getInvitationPreviewHandler
  );
  router.post(
    '/invitations/:token/accept',
    publicRoute(),
    authLimiter,
    validate({ params: inviteTokenParamSchema, body: acceptInviteSchema }),
    ctrl.acceptInvitationHandler
  );
  router.post(
    '/invitations',
    authorize('invitation.create', 'scope'),
    writeLimiter,
    validate({ body: createInvitationSchema }),
    ctrl.createInvitationHandler
  );
  router.post(
    '/invitations/:id/revoke',
    authorize('invitation.revoke', 'invitation'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonOptionalSchema }),
    ctrl.revokeInvitationHandler
  );

  router.get('/users/me/profile', authorize('self.read', 'user'), ctrl.getMyProfileHandler);
  router.patch(
    '/users/me/profile',
    authorize('self.update', 'user'),
    writeLimiter,
    validate({ body: updateProfileSchema }),
    ctrl.updateMyProfileHandler
  );
  router.get(
    '/users/search',
    authorize('user.searchForTeam', 'scope'),
    validate({ query: searchUsersQuerySchema }),
    ctrl.searchUsersHandler
  );
  router.get(
    '/users',
    authorize('user.list', 'scope'),
    validate({ query: listUsersQuerySchema }),
    ctrl.listUsersHandler
  );
  router.get(
    '/users/:id',
    authorize('user.read', 'user'),
    validate({ params: idParamSchema }),
    ctrl.getUserByIdHandler
  );
  router.post(
    '/users/:id/deactivate',
    authorize('user.deactivate', 'user'),
    writeLimiter,
    validate({ params: idParamSchema, body: deactivateUserSchema }),
    ctrl.deactivateUserHandler
  );
  router.post(
    '/users/:id/reactivate',
    authorize('user.reactivate', 'user'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonOptionalSchema }),
    ctrl.reactivateUserHandler
  );
  router.post(
    '/users/:id/reset-password',
    authorize('user.resetPassword', 'user'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.resetPasswordHandler
  );
  router.post(
    '/users/:id/roles',
    authorize('role.assign', 'user'),
    writeLimiter,
    validate({ params: idParamSchema, body: assignRoleSchema }),
    ctrl.assignRoleHandler
  );
  router.delete(
    '/users/:id/roles/:assignmentId',
    authorize('role.revoke', 'user'),
    writeLimiter,
    validate({ params: roleRevokeParamSchema, body: reasonRequiredSchema }),
    ctrl.revokeRoleHandler
  );

  router.get(
    '/investors/pending',
    authorize('investor.review', 'university'),
    validate({ query: paginationQuerySchema }),
    ctrl.listPendingInvestorsHandler
  );
  router.post(
    '/investors/:id/approve',
    authorize('investor.review', 'university'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonOptionalSchema }),
    ctrl.approveInvestorHandler
  );
  router.post(
    '/investors/:id/reject',
    authorize('investor.review', 'university'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonOptionalSchema }),
    ctrl.rejectInvestorHandler
  );

  return router;
}
