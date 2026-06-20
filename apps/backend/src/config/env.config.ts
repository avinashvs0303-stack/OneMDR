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
  APP_NAME: z.string().default('OneMDR'),
  API_PREFIX: z.string().default('api/v1'),

  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Supabase ───────────────────────────────────────────────────────────────
  // URL and anon key: https://<project>.supabase.co (from Supabase dashboard → Settings → API)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  // Service role key — never expose to browser. Used for Admin API (invite users, set app_metadata).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  // JWT secret — kept for backwards compatibility but no longer used for verification.
  // Supabase now signs JWTs with ES256; we verify via the public JWKS endpoint instead.
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),

  // ── Field Encryption ───────────────────────────────────────────────────────
  // AES-256-GCM requires exactly 32 bytes. Provide as 64 hex chars.
  // Used for MFA secrets stored in the database.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

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
      console.warn(`\n⚠️  Placeholder secrets detected in: ${warnFields.join(', ')}`);
      console.warn('   Run: openssl rand -hex 32  to generate real secrets.\n');
    }
  }

  return result.data;
}
