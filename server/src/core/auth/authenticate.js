import { USER_STATUSES } from '@spp/shared/constants';
import User from '../../modules/auth/user.model.js';
import { AppError } from '../errors/AppError.js';
import { verifyAccessToken } from './tokens.js';

const MUST_CHANGE_PASSWORD_ALLOWLIST = new Set([
  '/api/v1/auth/change-password',
  '/api/v1/auth/me',
  '/api/v1/auth/logout',
]);

function normalizeRequestPath(req) {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}` || req.originalUrl || '';
  return fullPath.split('?')[0].replace(/\/+$/, '');
}

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHENTICATED');
    }
    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) {
      throw new AppError('UNAUTHENTICATED');
    }

    const payload = verifyAccessToken(rawToken);
    const user = await User.findById(payload.sub)
      .select('name email status accountType collegeId departmentId roles tokenVersion mustChangePassword createdAt')
      .lean();

    if (!user || user.tokenVersion !== payload.tv) {
      throw new AppError('UNAUTHENTICATED');
    }
    if (user.status === USER_STATUSES.DEACTIVATED || user.status === USER_STATUSES.REJECTED) {
      throw new AppError('ACCOUNT_DEACTIVATED');
    }

    const normalizedPath = normalizeRequestPath(req);
    if (user.mustChangePassword && !MUST_CHANGE_PASSWORD_ALLOWLIST.has(normalizedPath)) {
      throw new AppError('PASSWORD_CHANGE_REQUIRED');
    }

    req.user = { ...user, id: String(user._id) };
    next();
  } catch (err) {
    next(err);
  }
}
