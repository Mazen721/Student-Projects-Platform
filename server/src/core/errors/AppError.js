import { t } from '@spp/shared/locales/ar';
import { ERROR_CODES } from './errorCodes.js';

export class AppError extends Error {
  constructor(code, { status, vars = {}, rule, fields, details } = {}) {
    const def = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;
    const resolvedCode = def.code;
    const messageKey = rule ? `rules.${rule}` : `errors.${resolvedCode}`;
    const resolvedMessage = t(messageKey, vars);
    const fallbackMessage =
      resolvedMessage === messageKey ? t(`errors.${resolvedCode}`, vars) : resolvedMessage;

    super(fallbackMessage);
    this.name = 'AppError';
    this.code = resolvedCode;
    this.status = status ?? def.status;
    this.vars = vars;
    this.rule = rule;
    this.fields = fields;
    this.details = details;
  }

  static notFound(vars) {
    return new AppError('NOT_FOUND', { vars });
  }

  static forbidden(vars) {
    return new AppError('FORBIDDEN', { vars });
  }

  static businessRule(rule, vars = {}, details) {
    return new AppError('BUSINESS_RULE', { rule, vars, details });
  }
}
