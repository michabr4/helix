CREATE TABLE IF NOT EXISTS mgm.journey_milestones (
  milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 50,
  phase TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  target_date DATE NOT NULL,
  completed_date DATE,
  owner TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jm_customer ON mgm.journey_milestones (customer_id);
