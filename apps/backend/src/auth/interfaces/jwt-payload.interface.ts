import type { UserRole } from '@onemdr/database';

/**
 * The shape Railway reads from a verified Supabase JWT.
 *
 * Supabase signs JWTs with SUPABASE_JWT_SECRET. Railway verifies locally (no network call).
 * `sub` and `tenantId` originate from app_metadata — only writable by service_role,
 * making them the trusted security boundary for tenant/role claims.
 */
export interface JwtPayload {
  sub: string; // Our users.id (from app_metadata.user_id)
  supabaseId: string; // Supabase auth.users.id (the raw JWT `sub` claim)
  tenantId: string; // From app_metadata.tenant_id
  role: UserRole; // From app_metadata.app_role
  email: string; // From Supabase JWT top-level email claim
  iat?: number;
  exp?: number;
}

/** Raw Supabase JWT structure before our validation + mapping */
export interface SupabaseJwtPayload {
  sub: string;
  email: string;
  aud: string;
  role: string; // Supabase role ("authenticated"), not our app role
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  exp: number;
  iat: number;
}
