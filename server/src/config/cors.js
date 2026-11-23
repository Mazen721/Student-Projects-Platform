import { env } from './env.js';

export function buildAllowedOrigins(clientUrlList = env.CLIENT_URL) {
  const entries = clientUrlList
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set(entries);
}

const allowedOrigins = buildAllowedOrigins();

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  return allowedOrigins.has(origin.trim().replace(/\/+$/, ''));
}

export const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
};
