-- ============================================================
--  Migration 003 — Super Admin seed (run ONCE manually)
--  Run this in: Supabase → SQL Editor  (after 001 + 002)
--
--  BEFORE running:
--    Generate an argon2id hash for the admin password.
--    From the repo root, run:
--      node -e "
--        const argon2 = require('argon2');
--        argon2.hash('YourStrongPassword!1').then(h => console.log(h));
--      "
--    Paste the output as the password_hash value below.
--
--  OR use the /api/v1/auth/hash-dev endpoint if enabled in dev mode.
-- ============================================================

-- ── 1. Platform tenant (Clarbit internal) ────────────────────

INSERT INTO tenants (id, name, slug, plan, is_active, max_users, license_modules)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Clarbit Platform',
  'clarbit-platform',
  'ENTERPRISE',
  true,
  9999,
  ARRAY['SIEM','HUNT','COVERAGE','DETECTIONS','REPORTS','AUTOMATIONS']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Super admin user ───────────────────────────────────────
--
--  Replace <ARGON2ID_HASH> with the output of the hash command above.
--  Replace admin@clarbit.com / Admin / User with real values.

INSERT INTO users (
  tenant_id, email, first_name, last_name,
  role, password_hash, email_verified, is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@clarbit.com',
  'Admin',
  'User',
  'SUPER_ADMIN',
  '<ARGON2ID_HASH>',   -- ← replace this
  true,
  true
)
ON CONFLICT (email, tenant_id) DO NOTHING;
