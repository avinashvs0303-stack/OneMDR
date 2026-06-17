-- ============================================================
--  Migration 002 — Tenant Requests + License Fields
--  Run this in: Supabase → SQL Editor
-- ============================================================

-- 1. New enums ─────────────────────────────────────────────────────────────────

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'OWNER';

CREATE TYPE tenant_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. New audit actions ─────────────────────────────────────────────────────────

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TENANT_REQUEST_SUBMITTED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TENANT_REQUEST_APPROVED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'TENANT_REQUEST_REJECTED';

-- 3. Add license columns to tenants ───────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_users          INTEGER   NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS license_modules    TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ;

-- 4. Create tenant_requests table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Applicant
  company_name        TEXT NOT NULL,
  company_size        TEXT,
  industry            TEXT,
  website             TEXT,
  contact_name        TEXT NOT NULL,
  contact_email       TEXT NOT NULL UNIQUE,
  contact_phone       TEXT,
  use_case            TEXT,

  -- Workflow
  status              tenant_request_status NOT NULL DEFAULT 'PENDING',
  reviewed_by_id      UUID,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  admin_notes         TEXT,

  -- License (set during approval)
  plan_type           tenant_plan NOT NULL DEFAULT 'FREE',
  max_users           INTEGER NOT NULL DEFAULT 10,
  license_modules     TEXT[]  NOT NULL DEFAULT '{}',
  license_expires_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Linked tenant after approval
  tenant_id           UUID UNIQUE REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_requests_status
  ON tenant_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_requests_email
  ON tenant_requests (contact_email);

-- 5. Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_requests_updated_at ON tenant_requests;
CREATE TRIGGER trg_tenant_requests_updated_at
  BEFORE UPDATE ON tenant_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
