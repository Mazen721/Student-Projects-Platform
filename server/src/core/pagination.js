import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@spp/shared/constants';
import { paginationQuerySchema } from '@spp/shared/schemas';
import { t } from '@spp/shared/locales/ar';
import { AppError } from './errors/AppError.js';

export function parseSortSpec(rawSort, allowedSorts = ['createdAt', '-createdAt']) {
  const fallback = allowedSorts[0] || '-createdAt';
  const chosen = rawSort || fallback;
  if (!allowedSorts.includes(chosen)) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'sort', code: 'validation.invalidEnum', message: t('validation.invalidEnum') }],
    });
  }
  const descending = chosen.startsWith('-');
  const field = descending ? chosen.slice(1) : chosen;
  const direction = descending ? -1 : 1;
  return field === '_id' ? { _id: direction } : { [field]: direction, _id: direction };
}

export function parsePagination(query = {}, allowedSorts = ['-createdAt', 'createdAt']) {
  const parsed = paginationQuerySchema.parse(query);
  const page = Math.max(1, parsed.page ?? 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parsed.limit ?? DEFAULT_PAGE_LIMIT));
  const skip = (page - 1) * limit;
  const sort = parseSortSpec(parsed.sort, allowedSorts);
  return { page, limit, skip, sort };
}

export function buildPageMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
