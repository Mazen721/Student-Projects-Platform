import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLIENT_URL: z
    .string()
    .min(1)
    .refine((val) => !val.includes('*'), { message: 'CLIENT_URL must not contain wildcards' }),
  SEARCH_PROVIDER: z.enum(['atlas', 'text']).optional(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  TZ_DISPLAY: z.string().default('Africa/Cairo'),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(5).max(50).default(20),
  MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(1).max(10).default(2),
});

export function parseEnv(rawEnv = process.env) {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment configuration: ${details}`);
  }
  const data = parsed.data;
  const searchProvider = data.SEARCH_PROVIDER ?? (data.NODE_ENV === 'production' ? 'atlas' : 'text');
  return Object.freeze({ ...data, SEARCH_PROVIDER: searchProvider });
}

export const env = parseEnv(process.env);
