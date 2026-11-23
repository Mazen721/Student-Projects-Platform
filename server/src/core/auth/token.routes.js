import { Router } from 'express';
import { isAllowedOrigin } from '../../config/cors.js';
import { AppError } from '../errors/AppError.js';
import { publicRoute } from '../authz/authorize.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
  revokeRefreshToken,
  rotateRefreshToken,
} from './tokens.js';

function extractRequestOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

export function verifyCookieCsrf(req, _res, next) {
  if (req.get('x-requested-with') !== 'spp') {
    next(AppError.forbidden());
    return;
  }
  const origin = extractRequestOrigin(req);
  if (!isAllowedOrigin(origin)) {
    next(AppError.forbidden());
    return;
  }
  next();
}

export function createAuthTokenRouter() {
  const router = Router();

  router.post('/refresh', publicRoute(), verifyCookieCsrf, async (req, res, next) => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const { accessToken, refreshToken, user } = await rotateRefreshToken(rawToken, {
        userAgent: req.get('user-agent') || '',
        ip: req.ip,
      });
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({ data: { accessToken, user } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', publicRoute(), verifyCookieCsrf, async (req, res, next) => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
      await revokeRefreshToken(rawToken);
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
        secure: REFRESH_COOKIE_OPTIONS.secure,
        sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
        path: REFRESH_COOKIE_OPTIONS.path,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
