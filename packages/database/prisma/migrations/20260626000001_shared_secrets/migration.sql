-- One-Time Secret Sharing
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS shared_secrets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  creator_id      UUID,
  creator_name    TEXT,
  label           TEXT,
  token_hash      TEXT NOT NULL UNIQUE,
  encrypted_blob  TEXT NOT NULL,
  has_passphrase  BOOLEAN NOT NULL DEFAULT FALSE,
  passphrase_hash TEXT,
  ttl_seconds     INTEGER NOT NULL DEFAULT 86400,
  expires_at      TIMESTAMPTZ NOT NULL,
  viewed_at       TIMESTAMPTZ,
  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_secrets_token   ON shared_secrets(token_hash);
CREATE INDEX IF NOT EXISTS idx_shared_secrets_tenant  ON shared_secrets(tenant_id, created_at DESC);
ALTER TABLE shared_secrets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_secrets' AND policyname = 'service_role_bypass') THEN
    EXECUTE 'CREATE POLICY "service_role_bypass" ON shared_secrets TO service_role USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;
