-- SOC Operations: Documents, Change Management, Service Requests, Roster, Collaboration
-- Run in Supabase SQL Editor

-- ── soc_documents ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'General',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  author_id    UUID,
  author_name  TEXT,
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_documents_tenant    ON soc_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_documents_category  ON soc_documents(tenant_id, category);
ALTER TABLE soc_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_documents' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_documents TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── soc_changes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  change_ref      TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  change_type     TEXT NOT NULL DEFAULT 'STANDARD',
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  risk_level      TEXT NOT NULL DEFAULT 'LOW',
  impact          TEXT NOT NULL DEFAULT '',
  rollback_plan   TEXT NOT NULL DEFAULT '',
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  requester_id    UUID,
  requester_name  TEXT,
  approver_id     UUID,
  approver_name   TEXT,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_soc_changes_tenant_ref UNIQUE (tenant_id, change_ref),
  CONSTRAINT chk_soc_change_type   CHECK (change_type IN ('STANDARD','NORMAL','EMERGENCY')),
  CONSTRAINT chk_soc_change_priority CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  CONSTRAINT chk_soc_change_status CHECK (status IN ('DRAFT','REVIEW','APPROVED','IMPLEMENTING','COMPLETED','REJECTED')),
  CONSTRAINT chk_soc_change_risk   CHECK (risk_level IN ('CRITICAL','HIGH','MEDIUM','LOW'))
);

CREATE INDEX IF NOT EXISTS idx_soc_changes_tenant         ON soc_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_changes_tenant_status  ON soc_changes(tenant_id, status);
ALTER TABLE soc_changes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_changes' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_changes TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── soc_service_requests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_service_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_ref     TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'ACCESS',
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',
  status          TEXT NOT NULL DEFAULT 'OPEN',
  requester_id    UUID,
  requester_name  TEXT,
  assignee_id     UUID,
  assignee_name   TEXT,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_soc_requests_tenant_ref UNIQUE (tenant_id, request_ref),
  CONSTRAINT chk_soc_req_category CHECK (category IN ('ACCESS','TOOL','REPORT','TRAINING','INTEGRATION','OTHER')),
  CONSTRAINT chk_soc_req_priority CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  CONSTRAINT chk_soc_req_status CHECK (status IN ('OPEN','IN_PROGRESS','PENDING_APPROVAL','RESOLVED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_soc_requests_tenant        ON soc_service_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_requests_tenant_status ON soc_service_requests(tenant_id, status);
ALTER TABLE soc_service_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_service_requests' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_service_requests TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── soc_roster_shifts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_roster_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  shift_type    TEXT NOT NULL,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  analyst_id    UUID,
  analyst_name  TEXT,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  is_oncall     BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_soc_roster_shift UNIQUE (tenant_id, week_start, shift_type, day_of_week),
  CONSTRAINT chk_soc_shift_type CHECK (shift_type IN ('MORNING','AFTERNOON','NIGHT','GENERAL'))
);

CREATE INDEX IF NOT EXISTS idx_soc_roster_tenant_week ON soc_roster_shifts(tenant_id, week_start);
ALTER TABLE soc_roster_shifts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_roster_shifts' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_roster_shifts TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── soc_channels ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'hash',
  is_private  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_soc_channels_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_soc_channels_tenant ON soc_channels(tenant_id);
ALTER TABLE soc_channels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_channels' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_channels TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── soc_messages ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES soc_channels(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  author_id    UUID NOT NULL,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL DEFAULT 'MEMBER',
  content      TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT',
  metadata     JSONB,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_soc_msg_type CHECK (message_type IN ('TEXT','ALERT','SYSTEM','FILE'))
);

CREATE INDEX IF NOT EXISTS idx_soc_messages_channel     ON soc_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc_messages_tenant      ON soc_messages(tenant_id);
ALTER TABLE soc_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soc_messages' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON soc_messages TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_soc_documents_updated_at') THEN
    CREATE TRIGGER set_soc_documents_updated_at BEFORE UPDATE ON soc_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_soc_changes_updated_at') THEN
    CREATE TRIGGER set_soc_changes_updated_at BEFORE UPDATE ON soc_changes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_soc_requests_updated_at') THEN
    CREATE TRIGGER set_soc_requests_updated_at BEFORE UPDATE ON soc_service_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
