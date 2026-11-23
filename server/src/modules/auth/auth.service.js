import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  ACCOUNT_TYPES,
  INVITATION_KINDS,
  INVITE_EXPIRY_DAYS,
  PRIVACY_VISIBILITY,
  ROLES,
  SCOPE_TYPES,
  TEMP_PASSWORD_LENGTH,
  USER_STATUSES,
} from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import {
  hashOpaqueToken,
  hashPassword,
  issueSessionTokens,
  revokeAllUserTokens,
  verifyAccessToken,
  verifyPassword,
} from '../../core/auth/tokens.js';
import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import {
  assertActiveCollegeAndDepartment,
  getAllowedEmailDomains,
  resolveScopeHierarchy,
} from '../organization/orgLookup.service.js';
import Invitation from './invitation.model.js';
import User from './user.model.js';

const ROLE_RANK = Object.freeze({
  [ROLES.UNIVERSITY_ADMIN]: 5,
  [ROLES.COLLEGE_ADMIN]: 4,
  [ROLES.DEPARTMENT_ADMIN]: 3,
  [ROLES.SUPERVISOR]: 2,
  [ROLES.COMMITTEE_MEMBER]: 2,
  [ROLES.STUDENT]: 1,
  [ROLES.INVESTOR]: 1,
  [ROLES.VISITOR]: 1,
});

const PUBLIC_USER_PROJECTION = '-passwordHash';

function toSafeUser(userDoc) {
  if (!userDoc) return null;
  const plain = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };
  delete plain.passwordHash;
  plain.id = String(plain._id);
  return plain;
}

export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [
    letters[crypto.randomInt(letters.length)],
    digits[crypto.randomInt(digits.length)],
  ];
  while (chars.length < length) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
  return chars.sort(() => crypto.randomInt(3) - 1).join('');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getActorTopAssignment(actor) {
  const assignments = Array.isArray(actor?.roles) ? actor.roles : [];
  return assignments.reduce((best, current) => {
    if (!best) return current;
    return (ROLE_RANK[current.role] || 0) > (ROLE_RANK[best.role] || 0) ? current : best;
  }, null);
}

function assertDelegationAllowed(actor, targetRole, resolvedScope) {
  const top = getActorTopAssignment(actor);
  if (!top) throw AppError.forbidden();

  if (top.role === ROLES.UNIVERSITY_ADMIN) {
    return;
  }
  if (top.role === ROLES.COLLEGE_ADMIN) {
    if ((ROLE_RANK[targetRole] || 0) >= ROLE_RANK[ROLES.COLLEGE_ADMIN]) {
      throw AppError.forbidden();
    }
    if (String(resolvedScope.collegeId || '') !== String(top.collegeId || top.scopeId || '')) {
      throw AppError.forbidden();
    }
    return;
  }
  if (top.role === ROLES.DEPARTMENT_ADMIN) {
    if ((ROLE_RANK[targetRole] || 0) >= ROLE_RANK[ROLES.DEPARTMENT_ADMIN]) {
      throw AppError.forbidden();
    }
    if (String(resolvedScope.departmentId || '') !== String(top.departmentId || top.scopeId || '')) {
      throw AppError.forbidden();
    }
    return;
  }
  throw AppError.forbidden();
}

async function assertUniqueActiveEmail(email, session) {
  const existing = await User.findOne({ email, emailReleased: false })
    .select('_id')
    .session(session || null)
    .lean();
  if (existing) {
    throw new AppError('DUPLICATE_EMAIL');
  }
}

export async function registerStudent(payload, meta = {}) {
  const allowedDomains = await getAllowedEmailDomains();
  const domain = payload.email.split('@')[1]?.toLowerCase() || '';
  if (!allowedDomains.includes(domain)) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'email', code: 'validation.emailDomain', message: t('validation.emailDomain') }],
    });
  }

  await assertActiveCollegeAndDepartment(payload.collegeId, payload.departmentId);
  await assertUniqueActiveEmail(payload.email);

  const dupStudent = await User.findOne({ studentId: payload.studentId, emailReleased: false })
    .select('_id')
    .lean();
  if (dupStudent) {
    throw new AppError('DUPLICATE_STUDENT_ID');
  }

  const passwordHash = await hashPassword(payload.password);
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    studentId: payload.studentId,
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STUDENT,
    collegeId: payload.collegeId,
    departmentId: payload.departmentId,
    roles: [
      {
        role: ROLES.STUDENT,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: payload.departmentId,
        collegeId: payload.collegeId,
        departmentId: payload.departmentId,
      },
    ],
  });

  const { accessToken, refreshToken } = await issueSessionTokens(user, meta);
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function registerInvestor(payload, meta = {}) {
  await assertUniqueActiveEmail(payload.email);
  const passwordHash = await hashPassword(payload.password);
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash,
    status: USER_STATUSES.PENDING,
    accountType: ACCOUNT_TYPES.INVESTOR,
    investor: {
      organization: payload.organization,
      fieldOfInterest: payload.fieldOfInterest,
    },
    roles: [{ role: ROLES.INVESTOR, scopeType: SCOPE_TYPES.SELF }],
  });

  const { accessToken, refreshToken } = await issueSessionTokens(user, meta);
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function registerVisitor(payload, meta = {}) {
  await assertUniqueActiveEmail(payload.email);
  const passwordHash = await hashPassword(payload.password);
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash,
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.VISITOR,
    roles: [{ role: ROLES.VISITOR, scopeType: SCOPE_TYPES.SELF }],
  });

  const { accessToken, refreshToken } = await issueSessionTokens(user, meta);
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function loginUser({ email, password }, meta = {}) {
  const user = await User.findOne({ email, emailReleased: false }).select('+passwordHash');
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS');
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    throw new AppError('INVALID_CREDENTIALS');
  }
  if (user.status === USER_STATUSES.DEACTIVATED || user.status === USER_STATUSES.REJECTED) {
    const rejectionReason = user.investor?.rejectionReason;
    throw new AppError('ACCOUNT_DEACTIVATED', {
      details: rejectionReason ? { rejectionReason } : undefined,
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = await issueSessionTokens(user, meta);
  return {
    accessToken,
    refreshToken,
    user: toSafeUser(user),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function changePassword(userId, { currentPassword, newPassword }, meta = {}) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw AppError.notFound();
  }

  if (!user.mustChangePassword || currentPassword) {
    if (!currentPassword) {
      throw new AppError('INVALID_CREDENTIALS');
    }
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError('INVALID_CREDENTIALS');
    }
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  await user.save();
  await revokeAllUserTokens(user._id);

  const { accessToken, refreshToken } = await issueSessionTokens(user, meta);
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function getCurrentUserProfile(userId, roleContextId) {
  const user = await User.findById(userId).select(PUBLIC_USER_PROJECTION).lean();
  if (!user) {
    throw AppError.notFound();
  }
  return {
    user: toSafeUser(user),
    roles: user.roles || [],
    activeRoleId: roleContextId || user.roles?.[0]?._id || null,
  };
}

export async function updateMyProfile(userId, payload) {
  const user = await User.findById(userId).select(PUBLIC_USER_PROJECTION);
  if (!user) {
    throw AppError.notFound();
  }

  if (payload.avatar) {
    user.profile.avatar = await verifyUpload(payload.avatar, {
      userId,
      expectedPurpose: 'avatar',
    });
  }
  if (payload.bio !== undefined) user.profile.bio = payload.bio;
  if (payload.skills !== undefined) user.profile.skills = payload.skills;
  if (payload.phone !== undefined) user.profile.phone = payload.phone;
  if (payload.socialLinks !== undefined) user.profile.socialLinks = payload.socialLinks;
  if (payload.privacy) {
    user.privacy = {
      ...user.privacy?.toObject?.(),
      ...payload.privacy,
    };
  }

  await user.save();
  return toSafeUser(user);
}

function isAdminViewer(viewer) {
  const adminRoles = new Set([
    ROLES.UNIVERSITY_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.DEPARTMENT_ADMIN,
  ]);
  return Array.isArray(viewer?.roles) && viewer.roles.some((r) => adminRoles.has(r.role));
}

export async function getUserProfileById(targetUserId, viewer) {
  const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION).lean();
  if (!target) {
    throw AppError.notFound();
  }

  const isSelf = String(target._id) === String(viewer.id);
  const safe = toSafeUser(target);
  if (isSelf) {
    return safe;
  }

  const adminView = isAdminViewer(viewer);
  if (safe.privacy?.email !== PRIVACY_VISIBILITY.PUBLIC && !adminView) {
    delete safe.email;
  }
  if (safe.privacy?.phone !== PRIVACY_VISIBILITY.PUBLIC && safe.profile) {
    delete safe.profile.phone;
  }
  if (safe.privacy?.socialLinks !== PRIVACY_VISIBILITY.PUBLIC && safe.profile) {
    delete safe.profile.socialLinks;
  }
  return safe;
}

export async function listUsers(scopeFilter = {}, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['-createdAt', 'createdAt', 'name']);
  const filter = { ...scopeFilter };

  if (query.status) filter.status = query.status;
  if (query.collegeId) filter.collegeId = query.collegeId;
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.role) filter['roles.role'] = query.role;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { studentId: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_USER_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map(toSafeUser),
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function searchUsersForTeam(query = {}) {
  const filter = {
    status: USER_STATUSES.ACTIVE,
    accountType: ACCOUNT_TYPES.STUDENT,
    emailReleased: false,
  };
  if (query.collegeId) filter.collegeId = query.collegeId;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: rx }, { studentId: rx }, { email: rx }];
  }

  const users = await User.find(filter)
    .select('_id name studentId collegeId departmentId profile.avatar')
    .limit(20)
    .lean();

  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    studentId: u.studentId,
    collegeId: u.collegeId,
    departmentId: u.departmentId,
    avatar: u.profile?.avatar || null,
  }));
}

export async function deactivateUser(targetUserId, { reason, releaseIdentifiers = false }, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION).session(session);
      if (!target) {
        throw AppError.notFound();
      }
      const before = toSafeUser(target);
      const shouldRelease = Boolean(releaseIdentifiers && target.accountType === ACCOUNT_TYPES.STUDENT);

      target.status = USER_STATUSES.DEACTIVATED;
      target.tokenVersion += 1;
      if (shouldRelease) {
        target.emailReleased = true;
      }
      await target.save({ session });
      await revokeAllUserTokens(target._id, session);
      if (shouldRelease) {
        const { removeImpostorMemberships } = await import('../projects/index.js');
        await removeImpostorMemberships(target._id, session, actor.id);
      }

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorTopAssignment(actor)?.role || '',
        action: shouldRelease ? 'user.releaseIdentifiers' : 'user.deactivate',
        targetType: 'user',
        targetId: target._id,
        scope: { collegeId: target.collegeId, departmentId: target.departmentId },
        before,
        after: toSafeUser(target),
        reason,
        ip,
        session,
      });

      updatedUser = toSafeUser(target);
    });
    return updatedUser;
  } finally {
    await session.endSession();
  }
}

export async function reactivateUser(targetUserId, { reason }, { actor, ip }) {
  const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION);
  if (!target) {
    throw AppError.notFound();
  }
  if (target.emailReleased) {
    throw new AppError('CONFLICT');
  }
  const before = toSafeUser(target);
  target.status = USER_STATUSES.ACTIVE;
  await target.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: 'user.reactivate',
    targetType: 'user',
    targetId: target._id,
    scope: { collegeId: target.collegeId, departmentId: target.departmentId },
    before,
    after: toSafeUser(target),
    reason,
    ip,
  });

  return toSafeUser(target);
}

export async function resetUserPassword(targetUserId, { actor, ip }) {
  const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION);
  if (!target) {
    throw AppError.notFound();
  }
  const temporaryPassword = generateTemporaryPassword(TEMP_PASSWORD_LENGTH);
  target.passwordHash = await hashPassword(temporaryPassword);
  target.mustChangePassword = true;
  target.tokenVersion += 1;
  await target.save();
  await revokeAllUserTokens(target._id);

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: 'user.resetPassword',
    targetType: 'user',
    targetId: target._id,
    scope: { collegeId: target.collegeId, departmentId: target.departmentId },
    after: { mustChangePassword: true },
    ip,
  });

  return { temporaryPassword };
}

export async function assignUserRole(targetUserId, { role, scopeType, scopeId }, { actor, ip }) {
  const resolved = await resolveScopeHierarchy(scopeType, scopeId);
  assertDelegationAllowed(actor, role, resolved);

  const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION);
  if (!target) {
    throw AppError.notFound();
  }

  const alreadyHas = target.roles.some(
    (r) =>
      r.role === role &&
      r.scopeType === scopeType &&
      String(r.scopeId || '') === String(resolved.scopeId || '')
  );
  if (alreadyHas) {
    throw new AppError('CONFLICT');
  }

  const before = toSafeUser(target);
  target.roles.push({
    role,
    scopeType,
    scopeId: resolved.scopeId,
    collegeId: resolved.collegeId,
    departmentId: resolved.departmentId,
    grantedBy: actor.id,
  });
  if (!target.collegeId && resolved.collegeId) target.collegeId = resolved.collegeId;
  if (!target.departmentId && resolved.departmentId) target.departmentId = resolved.departmentId;
  await target.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: 'role.assign',
    targetType: 'user',
    targetId: target._id,
    scope: { collegeId: resolved.collegeId || target.collegeId, departmentId: resolved.departmentId || target.departmentId },
    before,
    after: toSafeUser(target),
    ip,
  });

  return toSafeUser(target);
}

export async function revokeUserRole(targetUserId, assignmentId, { reason }, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await User.findById(targetUserId).select(PUBLIC_USER_PROJECTION).session(session);
      if (!target) {
        throw AppError.notFound();
      }
      const assignment = target.roles.id(assignmentId);
      if (!assignment) {
        throw AppError.notFound();
      }

      assertDelegationAllowed(actor, assignment.role, {
        collegeId: assignment.collegeId || target.collegeId,
        departmentId: assignment.departmentId || target.departmentId,
      });

      const before = toSafeUser(target);
      assignment.deleteOne();
      target.tokenVersion += 1;
      await target.save({ session });
      await revokeAllUserTokens(target._id, session);

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorTopAssignment(actor)?.role || '',
        action: 'role.revoke',
        targetType: 'user',
        targetId: target._id,
        scope: {
          collegeId: assignment.collegeId || target.collegeId,
          departmentId: assignment.departmentId || target.departmentId,
        },
        before,
        after: toSafeUser(target),
        reason,
        ip,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
}

export async function createRoleInvitation({ role, scopeType, scopeId }, { actor, ip }) {
  const resolved = await resolveScopeHierarchy(scopeType, scopeId);
  assertDelegationAllowed(actor, role, resolved);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const inv = await Invitation.create({
    kind: INVITATION_KINDS.ROLE,
    tokenHash,
    role,
    scopeType,
    scopeId: resolved.scopeId,
    collegeId: resolved.collegeId,
    departmentId: resolved.departmentId,
    createdBy: actor.id,
    expiresAt,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: 'invitation.create',
    targetType: 'invitation',
    targetId: inv._id,
    scope: { collegeId: resolved.collegeId, departmentId: resolved.departmentId },
    after: { role, scopeType, scopeId: resolved.scopeId, expiresAt },
    ip,
  });

  return {
    id: String(inv._id),
    url: `/accept-invite/${rawToken}`,
    expiresAt,
    role,
    scopeType,
    scopeLabel: resolved.scopeLabel,
  };
}

export async function getInvitationPreview(rawToken) {
  const tokenHash = hashOpaqueToken(rawToken);
  const inv = await Invitation.findOne({
    tokenHash,
    usedAt: null,
    revokedAt: null,
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  }).lean();

  if (!inv) {
    throw new AppError('INVITE_UNAVAILABLE');
  }
  const resolved = await resolveScopeHierarchy(inv.scopeType || SCOPE_TYPES.UNIVERSITY, inv.scopeId);
  return {
    kind: inv.kind,
    role: inv.role,
    scopeType: inv.scopeType,
    scopeLabel: resolved.scopeLabel,
    expiresAt: inv.expiresAt,
  };
}

async function resolveOptionalAuthUserId(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;
  const payload = verifyAccessToken(rawToken);
  return payload.sub;
}

export async function acceptRoleInvitation(rawToken, payload, { authHeader, userAgent, ip }) {
  const existingUserId = await resolveOptionalAuthUserId(authHeader);
  const tokenHash = hashOpaqueToken(rawToken);
  const session = await mongoose.startSession();

  try {
    let outcome;
    await session.withTransaction(async () => {
      const inv = await Invitation.findOneAndUpdate(
        {
          tokenHash,
          usedAt: null,
          revokedAt: null,
          expiresAt: mongoose.trusted({ $gt: new Date() }),
        },
        { $set: { usedAt: new Date() } },
        { new: true, session }
      );

      if (!inv || inv.kind !== INVITATION_KINDS.ROLE) {
        throw new AppError('INVITE_UNAVAILABLE');
      }

      let user;
      if (existingUserId) {
        user = await User.findById(existingUserId).select(PUBLIC_USER_PROJECTION).session(session);
        if (!user || user.status !== USER_STATUSES.ACTIVE) {
          throw AppError.forbidden();
        }
        user.roles.push({
          role: inv.role,
          scopeType: inv.scopeType,
          scopeId: inv.scopeId,
          collegeId: inv.collegeId,
          departmentId: inv.departmentId,
          grantedBy: inv.createdBy,
        });
        if (!user.collegeId && inv.collegeId) user.collegeId = inv.collegeId;
        if (!user.departmentId && inv.departmentId) user.departmentId = inv.departmentId;
        await user.save({ session });
      } else {
        if (!payload.name || !payload.email || !payload.password) {
          throw new AppError('VALIDATION_ERROR', {
            fields: [
              { path: 'email', code: 'validation.required', message: t('validation.required') },
            ],
          });
        }
        await assertUniqueActiveEmail(payload.email, session);
        const passwordHash = await hashPassword(payload.password);
        const created = await User.create(
          [
            {
              name: payload.name,
              email: payload.email,
              passwordHash,
              status: USER_STATUSES.ACTIVE,
              accountType: ACCOUNT_TYPES.STAFF,
              collegeId: inv.collegeId,
              departmentId: inv.departmentId,
              roles: [
                {
                  role: inv.role,
                  scopeType: inv.scopeType,
                  scopeId: inv.scopeId,
                  collegeId: inv.collegeId,
                  departmentId: inv.departmentId,
                  grantedBy: inv.createdBy,
                },
              ],
            },
          ],
          { session }
        );
        user = created[0];
      }

      inv.usedBy = user._id;
      await inv.save({ session });
      outcome = { user };
    });

    const tokens = await issueSessionTokens(outcome.user, { userAgent, ip });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: toSafeUser(outcome.user),
    };
  } finally {
    await session.endSession();
  }
}

export async function revokeInvitation(invitationId, { reason }, { actor, ip }) {
  const inv = await Invitation.findOneAndUpdate(
    { _id: invitationId, usedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!inv) {
    throw AppError.notFound();
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: 'invitation.revoke',
    targetType: 'invitation',
    targetId: inv._id,
    scope: { collegeId: inv.collegeId, departmentId: inv.departmentId },
    reason,
    ip,
  });

  return { id: String(inv._id), revokedAt: inv.revokedAt };
}

export async function listPendingInvestors(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['-createdAt', 'createdAt']);
  const filter = { accountType: ACCOUNT_TYPES.INVESTOR, status: USER_STATUSES.PENDING };

  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_USER_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map(toSafeUser),
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function reviewInvestor(investorId, decision, { reason }, { actor, ip }) {
  const user = await User.findOne({
    _id: investorId,
    accountType: ACCOUNT_TYPES.INVESTOR,
    status: USER_STATUSES.PENDING,
  }).select(PUBLIC_USER_PROJECTION);

  if (!user) {
    throw AppError.notFound();
  }

  const before = toSafeUser(user);
  user.status = decision === 'approve' ? USER_STATUSES.ACTIVE : USER_STATUSES.REJECTED;
  user.investor = {
    ...user.investor?.toObject?.(),
    reviewedBy: actor.id,
    reviewedAt: new Date(),
    ...(decision === 'reject' && reason ? { rejectionReason: reason } : {}),
  };
  if (decision === 'reject') {
    user.tokenVersion += 1;
    await revokeAllUserTokens(user._id);
  }
  await user.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorTopAssignment(actor)?.role || '',
    action: decision === 'approve' ? 'investor.approve' : 'investor.reject',
    targetType: 'user',
    targetId: user._id,
    before,
    after: toSafeUser(user),
    reason,
    ip,
  });

  return toSafeUser(user);
}

export async function createImportedUsers(records = []) {
  const prepared = await Promise.all(
    records.map(async (rec) => ({
      ...rec,
      passwordHash: await hashPassword(rec.temporaryPassword),
    }))
  );

  const docs = prepared.map((rec) => ({
    name: rec.name,
    email: rec.email,
    studentId: rec.studentId,
    passwordHash: rec.passwordHash,
    mustChangePassword: true,
    status: USER_STATUSES.ACTIVE,
    accountType: rec.accountType,
    collegeId: rec.collegeId,
    departmentId: rec.departmentId,
    roles: [
      {
        role: rec.role,
        scopeType: SCOPE_TYPES.DEPARTMENT,
        scopeId: rec.departmentId,
        collegeId: rec.collegeId,
        departmentId: rec.departmentId,
      },
    ],
  }));

  const inserted = await User.insertMany(docs, { ordered: false });
  return inserted.length;
}

export async function findExistingIdentifiers({ emails = [], studentIds = [] }) {
  const [byEmail, byStudentId] = await Promise.all([
    emails.length > 0
      ? User.find({ email: mongoose.trusted({ $in: emails }), emailReleased: false })
          .select('email')
          .lean()
      : [],
    studentIds.length > 0
      ? User.find({ studentId: mongoose.trusted({ $in: studentIds }), emailReleased: false })
          .select('studentId')
          .lean()
      : [],
  ]);

  return {
    existingEmails: new Set(byEmail.map((u) => u.email)),
    existingStudentIds: new Set(byStudentId.map((u) => u.studentId)),
  };
}

export async function getAuthDashboardCounts(scopeFilter = {}) {
  const [totalUsers, pendingInvestors] = await Promise.all([
    User.countDocuments({ ...scopeFilter, status: USER_STATUSES.ACTIVE }),
    User.countDocuments({ accountType: ACCOUNT_TYPES.INVESTOR, status: USER_STATUSES.PENDING }),
  ]);
  return { totalUsers, pendingInvestors };
}
