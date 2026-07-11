import { pool } from "../db.js";

export async function ensureCustomerHealthScoresTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.customer_health_scores (
      score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      health_score INTEGER NOT NULL CHECK (health_score BETWEEN 0 AND 100),
      adoption_score INTEGER NOT NULL DEFAULT 0,
      engagement_score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'green',
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chs_customer ON mgm.customer_health_scores (customer_id)
  `);
}
