-- Migration: RLS for all tables added after 002_rls_policies.sql
-- Run in Supabase SQL Editor
--
-- Strategy (same as 002_rls_policies.sql):
--   • NestJS backend on Railway uses service_role → BYPASSRLS → no restrictions
--   • All other roles (anon, authenticated) are explicitly blocked at DB layer
--   • RESTRICTIVE deny-all policy means even future permissive GRANTs can't leak data
--   • This is defence-in-depth: leaked Supabase URL / anon key = no data access
--
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE / IF EXISTS guards).

-- ── 1. Enable RLS on tables that were created without it ─────────────────────

ALTER TABLE IF EXISTS detections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_detections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS detection_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_log_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integrations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS siem_deployments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integration_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hunt_missions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hunt_evidence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hunt_iocs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_cases       ENABLE ROW LEVEL SECURITY;

-- ── 2. Restrictive deny-all policies ─────────────────────────────────────────
--
-- A RESTRICTIVE policy ANDs with any permissive policy, so even if a
-- future migration accidentally adds a permissive GRANT this block still
-- prevents access for anon / authenticated.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'detections' AND policyname = 'deny_all_detections') THEN
    CREATE POLICY "deny_all_detections" ON detections
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_detections' AND policyname = 'deny_all_tenant_detections') THEN
    CREATE POLICY "deny_all_tenant_detections" ON tenant_detections
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'detection_stats' AND policyname = 'deny_all_detection_stats') THEN
    CREATE POLICY "deny_all_detection_stats" ON detection_stats
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_log_sources' AND policyname = 'deny_all_tenant_log_sources') THEN
    CREATE POLICY "deny_all_tenant_log_sources" ON tenant_log_sources
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'deny_all_integrations') THEN
    CREATE POLICY "deny_all_integrations" ON integrations
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'siem_deployments' AND policyname = 'deny_all_siem_deployments') THEN
    CREATE POLICY "deny_all_siem_deployments" ON siem_deployments
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_logs' AND policyname = 'deny_all_integration_logs') THEN
    CREATE POLICY "deny_all_integration_logs" ON integration_logs
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hunt_missions' AND policyname = 'deny_all_hunt_missions') THEN
    CREATE POLICY "deny_all_hunt_missions" ON hunt_missions
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hunt_evidence' AND policyname = 'deny_all_hunt_evidence') THEN
    CREATE POLICY "deny_all_hunt_evidence" ON hunt_evidence
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hunt_iocs' AND policyname = 'deny_all_hunt_iocs') THEN
    CREATE POLICY "deny_all_hunt_iocs" ON hunt_iocs
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_cases' AND policyname = 'deny_all_support_cases') THEN
    CREATE POLICY "deny_all_support_cases" ON support_cases
      AS RESTRICTIVE FOR ALL USING (false);
  END IF;
END $$;

-- ── 3. Revoke all public/anon/authenticated access ───────────────────────────
--
-- Belt-and-suspenders: table-level GRANT removal prevents direct SQL access
-- even without RLS policies active.

REVOKE ALL ON detections         FROM anon, authenticated;
REVOKE ALL ON tenant_detections  FROM anon, authenticated;
REVOKE ALL ON detection_stats    FROM anon, authenticated;
REVOKE ALL ON tenant_log_sources FROM anon, authenticated;
REVOKE ALL ON integrations       FROM anon, authenticated;
REVOKE ALL ON siem_deployments   FROM anon, authenticated;
REVOKE ALL ON integration_logs   FROM anon, authenticated;
REVOKE ALL ON hunt_missions      FROM anon, authenticated;
REVOKE ALL ON hunt_evidence      FROM anon, authenticated;
REVOKE ALL ON hunt_iocs          FROM anon, authenticated;
REVOKE ALL ON support_cases      FROM anon, authenticated;
