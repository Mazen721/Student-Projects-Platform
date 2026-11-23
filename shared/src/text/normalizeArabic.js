const TASHKEEL_RE = /[\u064B-\u065F\u0670]/g;
const TATWEEL_RE = /\u0640/g;
const ALEF_RE = /[أإآٱ]/g;
const ARABIC_INDIC_DIGITS_RE = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_DIGITS_RE = /[\u06F0-\u06F9]/g;

export function normalizeDigits(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(ARABIC_INDIC_DIGITS_RE, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_DIGITS_RE, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.');
}

export function normalizeArabic(input) {
  if (typeof input !== 'string') return '';
  return normalizeDigits(input)
    .replace(TASHKEEL_RE, '')
    .replace(TATWEEL_RE, '')
    .replace(ALEF_RE, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
