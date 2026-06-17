import { z } from 'zod';

/**
 * Validates all environment variables at startup.
 * App exits immediately with a clear error if any required var is missing/malformed.
 * OWASP ASVS V14: Security configuration — fail fast, fail loudly.
 */
const envSchema = z.object({
  // ── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_NAME: z.string().default('Clarbit'),
  API_PREFIX: z.string().default('api/v1'),

  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── Field Encryption ───────────────────────────────────────────────────────
  // AES-256-GCM requires exactly 32 bytes. Provide as 64 hex chars.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // ── OAuth (optional) ───────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // ── Email (optional) ───────────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@clarbit.com'),

  // ── Frontend ───────────────────────────────────────────────────────────────
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // ── Stripe (Step 9 — optional until billing module) ───────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
    process.exit(1);
  }

  // Warn in dev if secrets look like placeholder values
  if (result.data.NODE_ENV === 'development') {
    const placeholders = ['CHANGE_ME', 'your_secret', 'example'];
    const warnFields: string[] = [];
    for (const [key, val] of Object.entries(result.data)) {
      if (typeof val === 'string' && placeholders.some((p) => val.includes(p))) {
        warnFields.push(key);
      }
    }
    if (warnFields.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`\n⚠️  Placeholder secrets detected in: ${warnFields.join(', ')}`);
      // eslint-disable-next-line no-console
      console.warn('   Run: openssl rand -hex 32  to generate real secrets.\n');
    }
  }

  return result.data;
}
