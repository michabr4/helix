import { pool } from "../db.js";

export async function ensureAuditEventsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.audit_events (
      event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      changes JSONB,
      ip_address TEXT,
      request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ae_actor ON mgm.audit_events (actor_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ae_resource ON mgm.audit_events (resource_type, created_at DESC)
  `);
}
