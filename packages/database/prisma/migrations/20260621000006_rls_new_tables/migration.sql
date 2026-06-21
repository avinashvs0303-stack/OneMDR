-- Migration: RLS for all tables added after 002_rls_policies.sql
-- Run in Supabase SQL Editor
--
-- Strategy (same as 002_rls_policies.sql):
--   • NestJS backend on Railway uses service_role → BYPASSRLS → no restrictions
--   • All other roles (anon, authenticated) are explicitly blocked at DB layer
--   • RESTRICTIVE deny-all policy means future permissive GRANTs can't leak data
--   • This is defence-in-depth: leaked Supabase URL / anon key = no data access
--
-- Safe to run multiple times and safe to run even when some tables do not yet
-- exist (all blocks check pg_tables before touching the table).

-- ── Helper: enable RLS + create deny-all policy + revoke in one block ─────────

DO $$ DECLARE
  tbl text;
  tables text[] := ARRAY[
    'detections',
    'tenant_detections',
    'detection_stats',
    'tenant_log_sources',
    'integrations',
    'siem_deployments',
    'integration_logs',
    'hunt_missions',
    'hunt_evidence',
    'hunt_iocs',
    'support_cases'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Skip tables that haven't been created yet
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      RAISE NOTICE 'Table % does not exist yet — skipping', tbl;
      CONTINUE;
    END IF;

    -- 1. Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- 2. Restrictive deny-all policy (skip if already exists)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename  = tbl
        AND policyname = 'deny_all_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL USING (false)',
        'deny_all_' || tbl, tbl
      );
    END IF;

    -- 3. Revoke all access from anon / authenticated
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', tbl);

    RAISE NOTICE 'RLS locked down: %', tbl;
  END LOOP;
END $$;
