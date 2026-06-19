-- ============================================================
-- 005_cleanup_and_super_admin.sql
-- Run in Supabase → SQL Editor → New query
--
-- PURPOSE:
--   1. Wipe all old seeded / test data (custom JWT era)
--   2. Re-create Clarbit Platform tenant
--   3. Re-create super admin user record (no password_hash)
--   4. Set app_metadata on the Supabase auth user so Railway
--      can verify their JWT and grant SUPER_ADMIN access
--
-- RUN ORDER:  001 → 002 → 004 → THIS FILE
-- ============================================================

-- ── Step A: Clear all old data ────────────────────────────────
-- Safe to truncate in this order (FK constraints respected).
-- RESTART IDENTITY keeps sequences clean.

TRUNCATE TABLE
  password_reset_tokens,
  refresh_tokens,
  audit_logs,
  users,
  tenant_requests,
  tenants
RESTART IDENTITY CASCADE;

-- ── Step B: Clarbit Platform tenant ──────────────────────────

INSERT INTO tenants (
  id, name, slug, plan, is_active, max_users, license_modules
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Clarbit Platform',
  'clarbit-platform',
  'ENTERPRISE',
  true,
  9999,
  ARRAY['SIEM','HUNT','COVERAGE','DETECTIONS','REPORTS','AUTOMATIONS']
);

-- ── Step C: Super admin user record ──────────────────────────
-- supabase_uid is NULL for now — filled in by Step E below
-- after you invite the user via Supabase Auth.

INSERT INTO users (
  id,
  tenant_id,
  email,
  first_name,
  last_name,
  role,
  email_verified,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000002',   -- fixed UUID so we can reference it
  '00000000-0000-0000-0000-000000000001',
  'admin@clarbit.com',                       -- ← change to your real super admin email
  'Super',
  'Admin',
  'SUPER_ADMIN',
  true,
  true
);

-- ============================================================
-- ── MANUAL STEPS AFTER RUNNING THIS SQL ──────────────────────
-- ============================================================
--
-- Step D — Invite the super admin in Supabase Auth:
--   Supabase Dashboard → Authentication → Users → Invite user
--   Email: admin@clarbit.com  (same as above)
--   After they click the invite link and set a password,
--   Supabase creates an auth.users record with a UUID.
--   Find that UUID: Authentication → Users → click the user → copy the UUID
--
-- Step E — Link the Supabase auth user to our users table:
--   Replace <SUPABASE_AUTH_UUID> with the UUID from Step D.

-- UPDATE public.users
-- SET supabase_uid = '<SUPABASE_AUTH_UUID>'
-- WHERE email = 'admin@clarbit.com';

-- Step F — Set app_metadata on the Supabase auth user:
--   This grants SUPER_ADMIN role in JWT claims.
--   Replace <SUPABASE_AUTH_UUID> with the UUID from Step D.
--   Run this in Supabase SQL Editor (it has service_role access
--   to auth schema which the app client does not).

-- UPDATE auth.users
-- SET raw_app_meta_data = jsonb_build_object(
--   'provider',    'email',
--   'providers',   ARRAY['email'],
--   'user_id',     '00000000-0000-0000-0000-000000000002',
--   'tenant_id',   '00000000-0000-0000-0000-000000000001',
--   'app_role',    'SUPER_ADMIN'
-- )
-- WHERE id = '<SUPABASE_AUTH_UUID>';

-- ============================================================
-- AFTER STEP E + F the super admin can log in at /auth/login
-- and access /admin/* (ClarbitEmailGuard requires @clarbit.com)
-- ============================================================
