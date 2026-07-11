import { pool } from "../db.js";

export async function ensureFieldNoticesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.field_notices (
      fn_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      affected_products JSONB DEFAULT '[]',
      workaround_available BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ NOT NULL,
      url TEXT,
      raw_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
