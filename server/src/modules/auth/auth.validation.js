import { z } from 'zod';
import {
  acceptInviteSchema,
  assignRoleSchema,
  changePasswordSchema,
  createInvitationSchema,
  deactivateUserSchema,
  listUsersQuerySchema,
  loginSchema,
  objectIdSchema,
  paginationQuerySchema,
  reasonOptionalSchema,
  reasonRequiredSchema,
  registerInvestorSchema,
  registerStudentSchema,
  registerVisitorSchema,
  searchUsersQuerySchema,
  updateProfileSchema,
} from '@spp/shared/schemas';

export const idParamSchema = z.object({ id: objectIdSchema });
export const demoLoginSchema = z.object({
  account: z.enum([
    'university_admin',
    'college_admin',
    'supervisor',
    'student_one',
    'student_two',
    'visitor',
  ]),
});
export const roleRevokeParamSchema = z.object({ id: objectIdSchema, assignmentId: objectIdSchema });
export const inviteTokenParamSchema = z.object({ token: z.string().trim().min(16).max(128) });

export {
  acceptInviteSchema,
  assignRoleSchema,
  changePasswordSchema,
  createInvitationSchema,
  deactivateUserSchema,
  listUsersQuerySchema,
  loginSchema,
  paginationQuerySchema,
  reasonOptionalSchema,
  reasonRequiredSchema,
  registerInvestorSchema,
  registerStudentSchema,
  registerVisitorSchema,
  searchUsersQuerySchema,
  updateProfileSchema,
};
