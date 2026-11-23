import { z } from 'zod';
import {
  DEFAULT_PAGE_LIMIT,
  LINK_HOST_ALLOWLIST,
  LINK_KIND_VALUES,
  MAX_PAGE_LIMIT,
  MAX_UPLOAD_BYTES,
  UPLOAD_PURPOSE_VALUES,
} from '../constants/index.js';
import { normalizeDigits } from '../text/normalizeArabic.js';

export const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string({ required_error: 'validation.required', invalid_type_error: 'validation.invalidString' })
  .regex(OBJECT_ID_RE, { message: 'validation.invalidObjectId' });

export function coerceNumberFromArabic(schema) {
  return z.preprocess((val) => {
    if (typeof val === 'string') {
      const normalized = normalizeDigits(val).trim();
      if (normalized === '') return undefined;
      const num = Number(normalized);
      return Number.isNaN(num) ? val : num;
    }
    return val;
  }, schema);
}

export const paginationQuerySchema = z.object({
  page: coerceNumberFromArabic(
    z.number().int('validation.positiveInt').min(1, 'validation.minValue').default(1)
  ).default(1),
  limit: coerceNumberFromArabic(
    z.number().int('validation.positiveInt').min(1, 'validation.minValue').max(MAX_PAGE_LIMIT, 'validation.maxValue').default(DEFAULT_PAGE_LIMIT)
  ).default(DEFAULT_PAGE_LIMIT),
  sort: z.string().trim().max(64, 'validation.maxLength').optional(),
});

export const httpsUrlSchema = z
  .string({ required_error: 'validation.required', invalid_type_error: 'validation.invalidString' })
  .trim()
  .url('validation.invalidUrl')
  .refine((value) => value.startsWith('https://'), { message: 'validation.invalidUrl' });

export const linkRefSchema = z
  .object({
    kind: z.enum(LINK_KIND_VALUES, { message: 'validation.invalidEnum' }),
    url: httpsUrlSchema,
    title: z.string().trim().max(150, 'validation.maxLength').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const allowedHosts = LINK_HOST_ALLOWLIST[data.kind];
    if (!allowedHosts) return;
    try {
      const hostname = new URL(data.url).hostname.toLowerCase().replace(/^www\./, '');
      const valid = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'validation.allowedLinkHost',
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'validation.invalidUrl',
      });
    }
  });

export const cloudinaryUploadResultSchema = z
  .object({
    public_id: z.string().min(1, 'validation.required'),
    version: z.number().int().positive(),
    signature: z.string().min(1, 'validation.required'),
    resource_type: z.enum(['image', 'raw'], { message: 'validation.invalidEnum' }),
    type: z.enum(['upload', 'authenticated'], { message: 'validation.invalidEnum' }),
    format: z.string().min(1, 'validation.required'),
    bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'errors.UPLOAD_INVALID'),
    secure_url: httpsUrlSchema,
    original_filename: z.string().min(1).max(255).optional(),
  })
  .strict();

export const signUploadSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSE_VALUES, { message: 'validation.invalidEnum' }),
    projectId: objectIdSchema.optional(),
    fileName: z.string().trim().min(1, 'validation.required').max(255, 'validation.maxLength'),
    mimeType: z.string().trim().min(1, 'validation.required').max(128, 'validation.maxLength'),
    bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'errors.UPLOAD_INVALID'),
  })
  .strict();

export const reasonBodySchema = z
  .object({
    reason: z.string().trim().min(3, 'validation.minLength').max(500, 'validation.maxLength'),
  })
  .strict();
