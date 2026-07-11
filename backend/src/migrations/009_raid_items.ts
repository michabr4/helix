import { pool } from "../db.js";

export async function ensureRaidItemsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.raid_items (
      item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      owner TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      due_date DATE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
