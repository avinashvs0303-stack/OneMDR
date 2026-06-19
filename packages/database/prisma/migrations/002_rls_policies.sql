-- ============================================================
--  Migration 002 — Row-Level Security (zero-trust multi-tenant)
--  Run this in: Supabase → SQL Editor  (after 001_initial_schema)
--
--  Strategy:
--    • NestJS backend connects via service_role / DATABASE_URL
--      which has BYPASSRLS privilege — application handles tenant
--      scoping at the query level.
--    • All other roles (anon, authenticated) are BLOCKED at the
--      DB layer. No direct client can read or write any data.
--    • This is defense-in-depth: even if the Supabase URL/anon
--      key is leaked, the data is inaccessible.
-- ============================================================

-- ── Enable RLS on all tables ─────────────────────────────────

ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_requests        ENABLE ROW LEVEL SECURITY;

-- ── Block all direct access (no policies = deny by default) ──
--
-- When RLS is enabled and NO policy grants access, every row
-- is invisible to that role.  The only role that bypasses this
-- is the service_role (our NestJS backend).
--
-- We explicitly create DENY-ALL policies so future "GRANT" on
-- these tables can't accidentally open access.

CREATE POLICY "deny_all_tenants" ON tenants
  AS RESTRICTIVE FOR ALL
  USING (false);

CREATE POLICY "deny_all_users" ON users
  AS RESTRICTIVE FOR ALL
  USING (false);

CREATE POLICY "deny_all_refresh_tokens" ON refresh_tokens
  AS RESTRICTIVE FOR ALL
  USING (false);

CREATE POLICY "deny_all_audit_logs" ON audit_logs
  AS RESTRICTIVE FOR ALL
  USING (false);

CREATE POLICY "deny_all_password_reset_tokens" ON password_reset_tokens
  AS RESTRICTIVE FOR ALL
  USING (false);

CREATE POLICY "deny_all_tenant_requests" ON tenant_requests
  AS RESTRICTIVE FOR ALL
  USING (false);

-- ── Revoke all public access on tables ───────────────────────
--
-- Belt-and-suspenders: remove public/anon grants so even a
-- direct SQL query can't read data.

REVOKE ALL ON tenants               FROM anon, authenticated;
REVOKE ALL ON users                 FROM anon, authenticated;
REVOKE ALL ON refresh_tokens        FROM anon, authenticated;
REVOKE ALL ON audit_logs            FROM anon, authenticated;
REVOKE ALL ON password_reset_tokens FROM anon, authenticated;
REVOKE ALL ON tenant_requests       FROM anon, authenticated;

-- ── Revoke access to all sequences ───────────────────────────

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
