-- Migration: Threat Hunting as a Service (THaaS)
-- Run in Supabase SQL Editor

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_status') THEN
    CREATE TYPE hunt_status AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETE', 'ARCHIVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_priority') THEN
    CREATE TYPE hunt_priority AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_evidence_type') THEN
    CREATE TYPE hunt_evidence_type AS ENUM ('FINDING', 'FALSE_POSITIVE', 'ARTIFACT', 'NOTE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_ioc_type') THEN
    CREATE TYPE hunt_ioc_type AS ENUM (
      'IP', 'DOMAIN', 'HASH_MD5', 'HASH_SHA1', 'HASH_SHA256',
      'URL', 'EMAIL', 'REGISTRY_KEY', 'FILE_PATH', 'OTHER'
    );
  END IF;
END $$;

-- ── hunt_missions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_missions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mission_ref  TEXT NOT NULL,
  title        TEXT NOT NULL,
  hypothesis   TEXT NOT NULL,
  status       hunt_status   NOT NULL DEFAULT 'PLANNED',
  priority     hunt_priority NOT NULL DEFAULT 'MEDIUM',
  tactic_id    TEXT,
  tactic       TEXT,
  techniques   TEXT[]        NOT NULL DEFAULT '{}',
  analyst_id   UUID,
  analyst_name TEXT,
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hunt_missions_tenant_ref_key UNIQUE (tenant_id, mission_ref)
);

CREATE INDEX IF NOT EXISTS hunt_missions_tenant_id_idx        ON hunt_missions (tenant_id);
CREATE INDEX IF NOT EXISTS hunt_missions_tenant_status_idx    ON hunt_missions (tenant_id, status);
CREATE INDEX IF NOT EXISTS hunt_missions_tenant_priority_idx  ON hunt_missions (tenant_id, priority);

-- ── hunt_evidence ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id       UUID NOT NULL REFERENCES hunt_missions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  type             hunt_evidence_type NOT NULL DEFAULT 'FINDING',
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'MEDIUM',
  is_false_positive BOOLEAN NOT NULL DEFAULT FALSE,
  raw_data         JSONB,
  analyst_id       UUID,
  analyst_name     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hunt_evidence_mission_id_idx ON hunt_evidence (mission_id);
CREATE INDEX IF NOT EXISTS hunt_evidence_tenant_id_idx  ON hunt_evidence (tenant_id);

-- ── hunt_iocs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_iocs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES hunt_missions(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  type       hunt_ioc_type NOT NULL,
  value      TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hunt_iocs_mission_id_idx    ON hunt_iocs (mission_id);
CREATE INDEX IF NOT EXISTS hunt_iocs_tenant_type_idx   ON hunt_iocs (tenant_id, type);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hunt_missions_set_updated_at ON hunt_missions;
DROP TRIGGER IF EXISTS hunt_evidence_set_updated_at ON hunt_evidence;

CREATE TRIGGER hunt_missions_set_updated_at
  BEFORE UPDATE ON hunt_missions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER hunt_evidence_set_updated_at
  BEFORE UPDATE ON hunt_evidence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE hunt_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_iocs     ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — app uses service role key via Railway
