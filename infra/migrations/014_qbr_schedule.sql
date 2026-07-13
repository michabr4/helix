-- 014_qbr_schedule.sql
--
-- Schedule + generated-content store for Agent 3 (QBR/EBR Content Assembly).
-- customer_id is TEXT to match the existing customer identity space used by
-- mgm.customer_health_scores, mgm.voc_signals, and mgm.sla_records (see the
-- data-availability note in src/agents/customerHealth.ts — there is no
-- customer_id <-> property_id mapping table in this schema). property_id is
-- optional and only used when an SDM wants to additionally ground a QBR in a
-- specific property's incident/adoption data.

CREATE TABLE IF NOT EXISTS mgm.qbr_schedule (
  qbr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  property_id UUID REFERENCES mgm.properties(property_id),
  scheduled_date DATE NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'quarterly' CHECK (cadence IN ('quarterly', 'annual', 'ad-hoc')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'content_ready', 'delivered', 'cancelled')),
  generated_content TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qbr_customer ON mgm.qbr_schedule (customer_id);
CREATE INDEX IF NOT EXISTS idx_qbr_scheduled_date ON mgm.qbr_schedule (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_qbr_status ON mgm.qbr_schedule (status);
