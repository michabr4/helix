-- 003_smart_licenses.sql
-- Persists Cisco Smart Licensing entitlements synced from the Smart Software Manager API.

CREATE TABLE IF NOT EXISTS cisco.smart_licenses (
  license_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_name      TEXT NOT NULL,
  virtual_account   TEXT,
  quantity          INT NOT NULL DEFAULT 0,
  in_use            INT NOT NULL DEFAULT 0,
  balance           INT NOT NULL DEFAULT 0,
  status            TEXT,
  expires_at        TIMESTAMPTZ,
  raw               JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_smart_license_name_account UNIQUE (license_name, virtual_account)
);

CREATE INDEX IF NOT EXISTS idx_smart_licenses_status ON cisco.smart_licenses (status);
