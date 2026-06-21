-- ============================================================
--  Migration: Add log_sources, device_types to detections
--             Add tenant_log_sources table
--             Add 475 new global detection rules from Excel source files
-- ============================================================

-- ── 1. Add new columns to detections ─────────────────────────────────────────

ALTER TABLE "detections"
  ADD COLUMN IF NOT EXISTS "log_sources"  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "device_types" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "detections_log_sources_idx"
  ON "detections" USING GIN ("log_sources");

-- ── 2. Backfill log_sources for the existing 100 global seed rules ────────────

-- Splunk SPL rules (DET-0001 to DET-0020): Windows + endpoint focused
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Windows Security','Endpoint Detection and Response','Network Communication'],
  "device_types" = ARRAY['Windows Endpoint','Windows AD','EDR']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'SPLUNK';

-- Sentinel KQL rules (DET-0021 to DET-0040): Azure + Windows focused
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Windows Security','Authentication','Azure Active Directory'],
  "device_types" = ARRAY['Windows AD','Identity Provider','Azure']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'SENTINEL';

-- Chronicle YARA-L rules (DET-0041 to DET-0055): network + DNS focused
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Network Communication','DNS','Authentication'],
  "device_types" = ARRAY['Firewall','DNS Server','Identity Provider']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'CHRONICLE';

-- Elastic EQL rules (DET-0056 to DET-0075): endpoint + network focused
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Windows Security','Endpoint Detection and Response','Network Communication'],
  "device_types" = ARRAY['Windows Endpoint','EDR','Network Device']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'ELASTIC';

-- QRadar AQL rules (DET-0076 to DET-0090): network + auth focused
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Network Communication','Authentication','Windows Security'],
  "device_types" = ARRAY['Firewall','Active Directory','Network Device']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'QRADAR';

-- SIGMA rules (DET-0091 to DET-0100): cross-platform
UPDATE "detections"
SET
  "log_sources"  = ARRAY['Windows Security','Authentication','Network Communication'],
  "device_types" = ARRAY['Windows Endpoint','Identity Provider','Firewall']
WHERE "rule_id" LIKE 'DET-00%' AND "platform" = 'SIGMA';

-- ── 3. Create tenant_log_sources table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tenant_log_sources" (
  "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "log_source"   TEXT        NOT NULL,
  "device_type"  TEXT,
  "vendor"       TEXT,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenant_id", "log_source")
);

CREATE INDEX IF NOT EXISTS "tls_tenant_idx" ON "tenant_log_sources"("tenant_id");

-- ── 4. Insert 475 new global detection rules ──────────────────────────────────

-- ============================================================
--  Auto-generated detection rules from Excel source files
--  Sources: Usecases Master 2022 09 29, Use-Cases Log Monitoring 2.7
--  Total: 475 rules (DET-0101 ... DET-0575)
-- ============================================================