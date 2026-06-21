-- Migration: Integration Activity Logs
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS integration_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id  UUID        NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event           TEXT        NOT NULL,
  level           TEXT        NOT NULL DEFAULT 'INFO',
  message         TEXT        NOT NULL,
  meta            JSONB,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_logs_tenant_created_idx
  ON integration_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS integration_logs_integration_created_idx
  ON integration_logs (integration_id, created_at DESC);

ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — app uses service role key via Railway
