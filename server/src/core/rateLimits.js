import rateLimit from 'express-rate-limit';
import { t } from '@spp/shared/locales/ar';
import { env } from '../config/env.js';

function createRateLimitHandler() {
  return (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: t('errors.RATE_LIMITED'),
      },
    });
  };
}

function makeLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: createRateLimitHandler(),
  });
}

export function createRateLimiters() {
  const globalLimiter = makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: env.RATE_LIMIT_GLOBAL_MAX,
  });

  const authLimiter = makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${req.ip}:${email}`;
    },
  });

  const voteUserLimiter = makeLimiter({
    windowMs: 60 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user?.id || req.ip,
  });

  const voteIpLimiter = makeLimiter({
    windowMs: 60 * 60 * 1000,
    max: 60,
  });

  const writeLimiter = makeLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.user?.id || req.ip,
  });

  const uploadSignLimiter = makeLimiter({
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user?.id || req.ip,
  });

  return {
    globalLimiter,
    authLimiter,
    voteLimiter: [voteUserLimiter, voteIpLimiter],
    writeLimiter,
    uploadSignLimiter,
  };
}
