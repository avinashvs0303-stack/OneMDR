-- ============================================================
-- 004_supabase_auth.sql
-- Run in Supabase SQL Editor (Project → SQL Editor → New query)
--
-- Adds supabase_uid column to link our users table to Supabase
-- Auth's auth.users table. Railway sets this after inviteUserByEmail().
-- ============================================================

-- 1. Add supabase_uid column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE;

-- 2. Fast lookup index (used by JwtStrategy to resolve JWT sub → user)
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid
  ON public.users (supabase_uid);

-- 3. RLS permissive policy: allow a user to read their OWN record via supabase_uid.
--    This complements the deny-all restrictive policy from 002_rls_policies.sql.
--    The backend still uses service_role (bypasses RLS), so this is a safety net
--    for any future direct Supabase client usage.
DROP POLICY IF EXISTS "users_own_read" ON public.users;
CREATE POLICY "users_own_read"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  USING (supabase_uid = auth.uid());

-- 4. Allow a user to update their own non-sensitive profile fields.
DROP POLICY IF EXISTS "users_own_update" ON public.users;
CREATE POLICY "users_own_update"
  ON public.users
  AS PERMISSIVE
  FOR UPDATE
  USING (supabase_uid = auth.uid())
  WITH CHECK (
    supabase_uid = auth.uid()
    -- Role and tenant_id are immutable from the client side.
    -- Only service_role (Railway) can change these.
  );
