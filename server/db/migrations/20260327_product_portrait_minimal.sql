-- Product portrait minimal persistence migration
-- Execute in Supabase SQL Editor (project SQL console)

BEGIN;

CREATE TABLE IF NOT EXISTS product_portrait_config (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  focus_industries TEXT[] DEFAULT ARRAY[]::TEXT[],
  risk_sensitivity VARCHAR(16) NOT NULL DEFAULT 'medium',
  watch_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  min_confidence INT NOT NULL DEFAULT 70,
  notify_by_email BOOLEAN NOT NULL DEFAULT TRUE,
  track_supply_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS product_portrait_rows (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  product_line VARCHAR(120) NOT NULL,
  coding_system VARCHAR(16) NOT NULL,
  code_value VARCHAR(64) NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  focus_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  focus_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id, product_line, coding_system, code_value)
);

CREATE TABLE IF NOT EXISTS product_portrait_versions (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  version_no INT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  rows_snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_product_portrait_config_scope ON product_portrait_config(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_portrait_rows_scope ON product_portrait_rows(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_portrait_versions_scope ON product_portrait_versions(organization_id, user_id, version_no);

COMMIT;
