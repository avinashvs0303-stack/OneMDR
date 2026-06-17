-- ============================================================
--  Clarbit PostgreSQL Initialization
--  Runs once on first container start.
--  Migrations (via Prisma) add the actual tables.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_bytes(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram indexes for ILIKE search

-- Default timezone
SET timezone = 'UTC';

-- ── Multi-tenancy: session-level GUC for RLS ────────────────────────────────
-- Application sets: SET LOCAL app.current_tenant_id = '<uuid>'
-- RLS policies read: current_setting('app.current_tenant_id')::uuid
-- This function safely returns NULL when not set (avoids errors on public routes)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
  WHEN undefined_object THEN
    RETURN NULL;
END;
$$;

-- ── Helper: updated_at auto-update trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Audit log: helper to create immutable audit entries ─────────────────────
-- Tables will be created by Prisma migrations.
-- This comment documents the intended audit_logs table contract:
--
-- audit_logs (
--   id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   tenant_id   UUID NOT NULL,
--   actor_id    UUID,           -- NULL for system events
--   action      TEXT NOT NULL,  -- e.g. 'auth.login', 'board.create'
--   resource    TEXT,           -- e.g. 'board', 'item'
--   resource_id UUID,
--   metadata    JSONB,
--   ip_address  INET,
--   user_agent  TEXT,
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- )
--
-- IMPORTANT: no UPDATE or DELETE policy on audit_logs — immutable by design.

-- ── Performance: advisory lock helper for distributed locks ─────────────────
-- Used by BullMQ / automation engine to prevent double-execution.
-- pg_try_advisory_lock(key) / pg_advisory_unlock(key)
-- No additional setup needed — built into Postgres.

COMMENT ON FUNCTION current_tenant_id() IS
  'Returns the tenant UUID from app.current_tenant_id GUC. Used by RLS policies.';
