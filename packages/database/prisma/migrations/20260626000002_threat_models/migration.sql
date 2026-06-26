-- Threat Modelling: Models, Components, Data Flows, Threats
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS threat_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  environment     TEXT NOT NULL DEFAULT 'HYBRID',
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  created_by_id   UUID,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tm_environment CHECK (environment IN ('CLOUD','ONPREM','HYBRID')),
  CONSTRAINT chk_tm_status      CHECK (status IN ('DRAFT','REVIEW','APPROVED','ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_threat_models_tenant ON threat_models(tenant_id, created_at DESC);
ALTER TABLE threat_models ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'threat_models' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON threat_models TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── Components ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tm_components (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id       UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL,
  name           TEXT NOT NULL,
  component_type TEXT NOT NULL,
  environment    TEXT NOT NULL DEFAULT 'CLOUD',
  cloud_provider TEXT,
  service_name   TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tmc_environment CHECK (environment IN ('CLOUD','ONPREM')),
  CONSTRAINT chk_tmc_provider    CHECK (cloud_provider IS NULL OR cloud_provider IN ('AWS','AZURE','GCP','OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_tm_components_model ON tm_components(model_id);
ALTER TABLE tm_components ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tm_components' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON tm_components TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── Data Flows ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tm_data_flows (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id               UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
  source_id              UUID NOT NULL REFERENCES tm_components(id) ON DELETE CASCADE,
  target_id              UUID NOT NULL REFERENCES tm_components(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  protocol               TEXT NOT NULL DEFAULT 'HTTPS',
  data_classification    TEXT NOT NULL DEFAULT 'INTERNAL',
  is_encrypted           BOOLEAN NOT NULL DEFAULT TRUE,
  crosses_trust_boundary BOOLEAN NOT NULL DEFAULT FALSE,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tmf_classification CHECK (data_classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','SECRET'))
);

CREATE INDEX IF NOT EXISTS idx_tm_flows_model ON tm_data_flows(model_id);
ALTER TABLE tm_data_flows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tm_data_flows' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON tm_data_flows TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── Threats ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tm_threats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id          UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
  component_id      UUID REFERENCES tm_components(id) ON DELETE SET NULL,
  flow_id           UUID REFERENCES tm_data_flows(id) ON DELETE SET NULL,
  tenant_id         UUID NOT NULL,
  source_ref        TEXT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  stride_category   TEXT NOT NULL,
  attack_tactic     TEXT NOT NULL DEFAULT '',
  attack_technique  TEXT NOT NULL DEFAULT '',
  likelihood        INTEGER NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact            INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score        INTEGER NOT NULL DEFAULT 9,
  status            TEXT NOT NULL DEFAULT 'OPEN',
  mitigation_notes  TEXT,
  is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tmt_stride  CHECK (stride_category IN ('SPOOFING','TAMPERING','REPUDIATION','INFO_DISCLOSURE','DENIAL_OF_SERVICE','ELEVATION_OF_PRIVILEGE')),
  CONSTRAINT chk_tmt_status  CHECK (status IN ('OPEN','MITIGATED','ACCEPTED','FALSE_POSITIVE'))
);

CREATE INDEX IF NOT EXISTS idx_tm_threats_model  ON tm_threats(model_id);
CREATE INDEX IF NOT EXISTS idx_tm_threats_tenant ON tm_threats(tenant_id);
ALTER TABLE tm_threats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tm_threats' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON tm_threats TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_threat_models_updated_at') THEN
    CREATE TRIGGER set_threat_models_updated_at BEFORE UPDATE ON threat_models FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_tm_threats_updated_at') THEN
    CREATE TRIGGER set_tm_threats_updated_at BEFORE UPDATE ON tm_threats FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
