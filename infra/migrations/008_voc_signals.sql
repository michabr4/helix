CREATE TABLE IF NOT EXISTS mgm.voc_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  sentiment_score NUMERIC(3,1) NOT NULL CHECK (sentiment_score BETWEEN 0 AND 10),
  summary TEXT NOT NULL,
  raw_text TEXT,
  customer_id TEXT,
  customer_name TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
