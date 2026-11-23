import { normalizeDigits } from './normalizeArabic.js';

const DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;
const NON_SLUG_CHARS_RE = /[^a-z0-9\u0621-\u064A]+/g;

export function slugify(input, fallback = 'project') {
  if (typeof input !== 'string') return fallback;
  const cleaned = normalizeDigits(input)
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim()
    .replace(NON_SLUG_CHARS_RE, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}
