-- ============================================================
--  Migration 001 — Full Initial Schema
--  Run this FIRST in: Supabase → SQL Editor
--  Includes: enums, tenants, users, auth tables, audit log
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tenant_plan AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MEMBER', 'GUEST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'AUTH_LOGIN',
    'AUTH_LOGOUT',
    'AUTH_REGISTER',
    'AUTH_PASSWORD_RESET',
    'AUTH_MFA_ENABLED',
    'AUTH_MFA_DISABLED',
    'AUTH_REFRESH_REVOKED',
    'TENANT_CREATED',
    'TENANT_UPDATED',
    'TENANT_DELETED',
    'TENANT_REQUEST_SUBMITTED',
    'TENANT_REQUEST_APPROVED',
    'TENANT_REQUEST_REJECTED',
    'USER_INVITED',
    'USER_ROLE_CHANGED',
    'USER_REMOVED',
    'RESOURCE_CREATED',
    'RESOURCE_UPDATED',
    'RESOURCE_DELETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tenants ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  slug                 TEXT        NOT NULL UNIQUE,
  plan                 tenant_plan NOT NULL DEFAULT 'FREE',
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  mfa_enforced         BOOLEAN     NOT NULL DEFAULT false,

  -- License / entitlements
  max_users            INTEGER     NOT NULL DEFAULT 10,
  license_modules      TEXT[]      NOT NULL DEFAULT '{}',
  license_expires_at   TIMESTAMPTZ,

  -- Billing (future)
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  billing_email           TEXT,
  trial_ends_at           TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                    UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID      NOT NULL REFERENCES tenants(id),
  email                 TEXT      NOT NULL,
  role                  user_role NOT NULL DEFAULT 'MEMBER',
  is_active             BOOLEAN   NOT NULL DEFAULT true,

  -- Profile
  first_name            TEXT      NOT NULL,
  last_name             TEXT      NOT NULL,
  avatar_url            TEXT,
  timezone              TEXT      NOT NULL DEFAULT 'UTC',
  locale                TEXT      NOT NULL DEFAULT 'en',

  -- Auth
  password_hash         TEXT,
  email_verified        BOOLEAN   NOT NULL DEFAULT false,
  email_verify_token    TEXT,
  email_verify_expires  TIMESTAMPTZ,

  -- MFA
  mfa_enabled           BOOLEAN   NOT NULL DEFAULT false,
  mfa_secret            TEXT,
  mfa_backup_codes      TEXT[]    NOT NULL DEFAULT '{}',

  -- OAuth
  google_id             TEXT      UNIQUE,

  -- Account lockout
  login_attempts        INTEGER   NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  last_login_ip         TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE (email, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);

-- ── Refresh Tokens ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  family_id   UUID        NOT NULL,
  device_info TEXT,
  ip_address  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens (family_id);

-- ── Audit Log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id),
  actor_id    UUID         REFERENCES users(id),
  action      audit_action NOT NULL,
  resource    TEXT,
  resource_id UUID,
  metadata    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_actor   ON audit_logs (tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action  ON audit_logs (tenant_id, action);

-- ── Password Reset Tokens ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);

-- ── Tenant Requests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_requests (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Applicant
  company_name        TEXT                  NOT NULL,
  company_size        TEXT,
  industry            TEXT,
  website             TEXT,
  contact_name        TEXT                  NOT NULL,
  contact_email       TEXT                  NOT NULL UNIQUE,
  contact_phone       TEXT,
  use_case            TEXT,

  -- Workflow
  status              tenant_request_status NOT NULL DEFAULT 'PENDING',
  reviewed_by_id      UUID,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  admin_notes         TEXT,

  -- License (set during approval)
  plan_type           tenant_plan           NOT NULL DEFAULT 'FREE',
  max_users           INTEGER               NOT NULL DEFAULT 10,
  license_modules     TEXT[]                NOT NULL DEFAULT '{}',
  license_expires_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ           NOT NULL DEFAULT now(),

  -- Linked tenant after approval
  tenant_id           UUID                  UNIQUE REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_requests_status
  ON tenant_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_requests_email
  ON tenant_requests (contact_email);

-- ── Auto-update updated_at trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tenant_requests_updated_at
    BEFORE UPDATE ON tenant_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Super Admin seed ──────────────────────────────────────────────────────────
-- Run separately after generating the argon2id hash (see README).
-- INSERT INTO tenants (id, name, slug, plan, is_active)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Clarbit Platform', 'clarbit-platform', 'ENTERPRISE', true);
--
-- INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash, email_verified)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'admin@clarbit.com', 'Super', 'Admin',
--         'SUPER_ADMIN', '<argon2id_hash>', true);
