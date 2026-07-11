import { pool } from "../db.js";

export async function ensurePostIncidentDocsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.post_incident_docs (
      doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      incident_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      timeline JSONB DEFAULT '[]',
      root_cause TEXT,
      action_items JSONB DEFAULT '[]',
      generated_by TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
