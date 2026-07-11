CREATE TABLE IF NOT EXISTS mgm.sla_records (
  sla_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL,
  customer_id TEXT,
  sla_type TEXT NOT NULL,
  target_hours NUMERIC(6,2) NOT NULL,
  actual_hours NUMERIC(6,2),
  breached BOOLEAN NOT NULL DEFAULT FALSE,
  breach_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
