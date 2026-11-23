import ar from '@/locales/ar';

const CAIRO_TIMEZONE = 'Africa/Cairo';
const AR_LOCALE_DATE = 'ar-EG-u-ca-gregory';
const AR_LOCALE_NUMBER = 'ar-EG-u-nu-latn';

const dateFormatter = new Intl.DateTimeFormat(AR_LOCALE_DATE, {
  timeZone: CAIRO_TIMEZONE,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(AR_LOCALE_DATE, {
  timeZone: CAIRO_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('ar-EG', {
  numeric: 'auto',
});

const integerFormatter = new Intl.NumberFormat(AR_LOCALE_NUMBER, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(AR_LOCALE_NUMBER, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const currencyNumberFormatter = new Intl.NumberFormat(AR_LOCALE_NUMBER, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const RELATIVE_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

function toValidDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toValidDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toValidDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatRelativeTime(value, now = Date.now()) {
  const date = toValidDate(value);
  if (!date) return '—';
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (absSeconds >= unitSeconds || unit === 'second') {
      const amount = Math.round(diffSeconds / unitSeconds);
      return relativeFormatter.format(amount, unit);
    }
  }
  return '—';
}

export function formatNumber(value, { decimals = 0 } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return decimals > 0 ? decimalFormatter.format(value) : integerFormatter.format(value);
}

export function formatPercent(value, { decimals = 1 } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const formatter = decimals === 0 ? integerFormatter : decimalFormatter;
  return `${formatter.format(value)}%`;
}

export function formatCurrencyEgp(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  return `${currencyNumberFormatter.format(amount)} ${ar.common.egpCurrency}`;
}
