-- Migration: Detection Metadata Fields
-- Run in Supabase SQL Editor

CREATE TYPE detection_rule_type AS ENUM (
  'ANOMALY', 'INVESTIGATE', 'HIGH_FIDELITY', 'CORRELATION', 'THREAT_INTEL'
);

CREATE TYPE detection_lifecycle AS ENUM (
  'EXPERIMENTAL', 'FUNCTIONAL', 'STABLE', 'RETIRED'
);

CREATE TYPE detection_workflow_status AS ENUM (
  'PENDING', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'ENABLED', 'DISABLED'
);

ALTER TABLE detections
  ADD COLUMN IF NOT EXISTS rule_type          detection_rule_type,
  ADD COLUMN IF NOT EXISTS lifecycle_stage    detection_lifecycle NOT NULL DEFAULT 'EXPERIMENTAL',
  ADD COLUMN IF NOT EXISTS workflow_status    detection_workflow_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS owner_name         TEXT,
  ADD COLUMN IF NOT EXISTS owner_id           UUID REFERENCES users(id) ON DELETE SET NULL;
