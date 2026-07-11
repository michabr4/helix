CREATE TABLE IF NOT EXISTS mgm.psirt_advisories (
  advisory_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  cvss_score NUMERIC(4,1),
  affected_products JSONB DEFAULT '[]',
  published_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
