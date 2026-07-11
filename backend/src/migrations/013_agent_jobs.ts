import { pool } from "../db.js";

export async function ensureAgentJobsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.agent_jobs (
      job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id      TEXT NOT NULL,
      agent_name    TEXT NOT NULL,
      role          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      input         JSONB NOT NULL DEFAULT '{}',
      output        JSONB,
      error         TEXT,
      started_at    TIMESTAMPTZ,
      finished_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent ON mgm.agent_jobs (agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON mgm.agent_jobs (status);

    CREATE TABLE IF NOT EXISTS mgm.agent_approvals (
      request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id        UUID REFERENCES mgm.agent_jobs(job_id),
      agent_id      TEXT NOT NULL,
      agent_name    TEXT NOT NULL,
      action        TEXT NOT NULL,
      context       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      reviewed_by   TEXT,
      reviewed_at   TIMESTAMPTZ,
      requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_approvals_status ON mgm.agent_approvals (status);
  `);
}
