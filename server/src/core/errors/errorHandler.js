import { ZodError } from 'zod';
import pino from 'pino';
import { t } from '@spp/shared/locales/ar';
import { env } from '../../config/env.js';
import { AppError } from './AppError.js';

const logger = pino({ level: env.NODE_ENV === 'test' ? 'silent' : 'info' });

function extractZodIssueVars(issue) {
  const vars = {};
  if (issue.minimum !== undefined) {
    vars.min = issue.minimum;
  }
  if (issue.maximum !== undefined) {
    vars.max = issue.maximum;
  }
  return vars;
}

function formatZodFields(zodError) {
  return zodError.issues.map((issue) => {
    const key = issue.message || 'validation.required';
    const message = t(key, extractZodIssueVars(issue));
    return {
      path: issue.path.join('.'),
      code: key,
      message: message === key ? t('errors.VALIDATION_ERROR') : message,
    };
  });
}

function mapMongoDuplicateError(err) {
  const keyFields = Object.keys(err.keyPattern || err.keyValue || {});
  if (keyFields.includes('email')) {
    return new AppError('DUPLICATE_EMAIL');
  }
  if (keyFields.includes('studentId')) {
    return new AppError('DUPLICATE_STUDENT_ID');
  }
  if (keyFields.includes('projectId') && keyFields.includes('userId')) {
    return new AppError('ALREADY_VOTED');
  }
  return new AppError('CONFLICT');
}

function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }
  if (err instanceof ZodError) {
    return new AppError('VALIDATION_ERROR', { fields: formatZodFields(err) });
  }
  if (err?.code === 11000) {
    return mapMongoDuplicateError(err);
  }
  if (err?.name === 'CastError') {
    return new AppError('VALIDATION_ERROR', {
      fields: [{ path: err.path || '', code: 'validation.invalidObjectId', message: t('validation.invalidObjectId') }],
    });
  }
  if (err?.name === 'MulterError') {
    return new AppError('UPLOAD_INVALID');
  }
  if (err?.type === 'entity.parse.failed') {
    return new AppError('VALIDATION_ERROR');
  }
  return null;
}

export function notFoundHandler(_req, _res, next) {
  next(AppError.notFound());
}

export function errorHandler(err, req, res, _next) {
  const normalized = normalizeError(err);
  if (normalized) {
    const payload = {
      code: normalized.code,
      message: normalized.message,
    };
    if (normalized.rule) payload.rule = normalized.rule;
    if (normalized.vars && Object.keys(normalized.vars).length > 0) payload.vars = normalized.vars;
    if (normalized.fields) payload.fields = normalized.fields;
    if (normalized.details) payload.details = normalized.details;
    return res.status(normalized.status).json({ error: payload });
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled server error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: t('errors.INTERNAL_ERROR'),
    },
  });
}
