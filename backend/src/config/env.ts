import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('12h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  PUBLIC_BASE_URL: z.string().url(),
  INVOICE_STORAGE_ROOT: z.string().default('storage/invoices'),
  DEFAULT_COUNTRY_CODE: z.string().default('91'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('Admin@123'),
});

export const env = EnvSchema.parse(process.env);
