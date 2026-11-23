import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { USER_STATUSES } from '@spp/shared/constants';
import { env } from '../../config/env.js';
import User from '../../modules/auth/user.model.js';
import RefreshToken from '../../modules/auth/refreshToken.model.js';
import { AppError } from '../errors/AppError.js';

const BCRYPT_COST = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = 'spp_rt';

export const REFRESH_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/api/v1/auth',
  maxAge: REFRESH_TTL_MS,
});

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

export function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function hashOpaqueToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function hashIp(ip) {
  if (!ip) return '';
  return crypto
    .createHmac('sha256', env.JWT_REFRESH_SECRET)
    .update(String(ip))
    .digest('hex');
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      tv: user.tokenVersion ?? 0,
    },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      throw new AppError('TOKEN_EXPIRED');
    }
    throw new AppError('UNAUTHENTICATED');
  }
}

export function verifyRefreshJwt(token) {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('UNAUTHENTICATED');
  }
}

export async function issueSessionTokens(user, { userAgent = '', ip = '', family } = {}) {
  const tokenFamily = family || crypto.randomUUID();
  const jti = crypto.randomUUID();
  const jtiHash = hashOpaqueToken(jti);

  const refreshToken = jwt.sign(
    {
      sub: String(user._id || user.id),
      fam: tokenFamily,
      jti,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL }
  );

  await RefreshToken.create({
    userId: user._id || user.id,
    family: tokenFamily,
    jtiHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: String(userAgent).slice(0, 300),
    ipHash: hashIp(ip),
  });

  const accessToken = signAccessToken(user);
  return { accessToken, refreshToken, jtiHash };
}

export async function rotateRefreshToken(rawRefreshToken, { userAgent = '', ip = '' } = {}) {
  if (!rawRefreshToken) {
    throw new AppError('UNAUTHENTICATED');
  }
  const payload = verifyRefreshJwt(rawRefreshToken);
  const jtiHash = hashOpaqueToken(payload.jti);
  const now = new Date();

  const existing = await RefreshToken.findOne({ jtiHash }).lean();
  if (!existing || existing.revokedAt) {
    await RefreshToken.updateMany(
      { userId: payload.sub, family: payload.fam, revokedAt: null },
      { $set: { revokedAt: now } }
    );
    throw new AppError('UNAUTHENTICATED');
  }

  const user = await User.findById(payload.sub)
    .select('name email status accountType collegeId departmentId roles tokenVersion mustChangePassword')
    .lean();

  if (!user || user.status === USER_STATUSES.DEACTIVATED || user.status === USER_STATUSES.REJECTED) {
    throw new AppError('UNAUTHENTICATED');
  }

  const next = await issueSessionTokens(user, { userAgent, ip, family: existing.family });

  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: existing._id, revokedAt: null },
    { $set: { revokedAt: now, replacedBy: next.jtiHash } }
  );
  if (!claimed) {
    await RefreshToken.updateMany(
      { userId: payload.sub, family: existing.family, revokedAt: null },
      { $set: { revokedAt: now } }
    );
    throw new AppError('UNAUTHENTICATED');
  }

  return {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    user,
  };
}

export async function revokeRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) return;
  try {
    const payload = verifyRefreshJwt(rawRefreshToken);
    const jtiHash = hashOpaqueToken(payload.jti);
    await RefreshToken.updateOne(
      { jtiHash, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  } catch {
    // Clearing an expired or malformed cookie on logout is a safe no-op.
  }
}

export async function revokeAllUserTokens(userId, session) {
  const options = session ? { session } : {};
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    options
  );
}
