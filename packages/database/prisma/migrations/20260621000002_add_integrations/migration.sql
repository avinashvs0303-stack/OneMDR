-- Migration: add SIEM integrations + deployment tracking
-- Run in Supabase SQL Editor

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_status') THEN
    CREATE TYPE integration_status AS ENUM ('UNCONFIGURED', 'CONNECTED', 'ERROR', 'DEGRADED');
  END IF;
END $$;

-- ── integrations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform      detection_platform NOT NULL,
  name          TEXT NOT NULL,
  host          TEXT NOT NULL DEFAULT '',
  config        JSONB NOT NULL DEFAULT '{}',
  status        integration_status NOT NULL DEFAULT 'UNCONFIGURED',
  last_tested_at TIMESTAMPTZ,
  error_message TEXT,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integrations_tenant_platform_name_key UNIQUE (tenant_id, platform, name)
);

CREATE INDEX IF NOT EXISTS integrations_tenant_id_idx ON integrations (tenant_id);

-- ── siem_deployments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS siem_deployments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  detection_id   UUID NOT NULL REFERENCES detections(id)   ON DELETE CASCADE,
  remote_id      TEXT,
  status         TEXT NOT NULL DEFAULT 'deployed',
  error_message  TEXT,
  deployed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT siem_deployments_integration_detection_key UNIQUE (integration_id, detection_id)
);

CREATE INDEX IF NOT EXISTS siem_deployments_integration_id_idx ON siem_deployments (integration_id);
CREATE INDEX IF NOT EXISTS siem_deployments_detection_id_idx   ON siem_deployments (detection_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integrations_set_updated_at   ON integrations;
DROP TRIGGER IF EXISTS siem_deployments_set_updated_at ON siem_deployments;

CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER siem_deployments_set_updated_at
  BEFORE UPDATE ON siem_deployments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE integrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE siem_deployments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — app uses service role key via Railway
