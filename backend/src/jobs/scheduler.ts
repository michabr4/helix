/**
 * scheduler.ts — reads integration_source_configs from the DB at startup and
 * registers a node-cron job for every enabled source that has a valid cron schedule.
 *
 * This means sync jobs actually run automatically instead of requiring a manual
 * API call to /api/v1/integrations/sync/:source.
 *
 * The scheduler is intentionally simple: it fires the existing syncHandlers map,
 * so adding a new source only requires an entry in syncHandlers.ts.
 */
import cron from "node-cron";
import { pool } from "../db.js";
import { syncHandlers } from "./syncHandlers.js";
import { slaMonitorAgent } from "../agents/slaMonitor.js";
import { incidentFirstResponseAgent } from "../agents/incidentFirstResponse.js";
import { statusReportAgent } from "../agents/statusReport.js";
import { postIncidentDocAgent } from "../agents/postIncidentDoc.js";

interface SourceConfig {
  source_name: string;
  schedule: string;
}

export async function startScheduler(): Promise<void> {
  let rows: SourceConfig[] = [];

  try {
    const result = await pool.query<SourceConfig>(
      `SELECT source_name, schedule
       FROM mgm.integration_source_configs
       WHERE enabled = true AND schedule IS NOT NULL AND schedule != 'manual'`
    );
    rows = result.rows;
  } catch (err) {
    // integration_source_configs may not exist yet on a fresh DB before migrations run.
    // Log and skip — the scheduler will not register any jobs this boot.
    console.warn(JSON.stringify({
      level: "warn",
      message: "scheduler_table_unavailable",
      error: String(err)
    }));
    return;
  }

  let registered = 0;

  for (const { source_name, schedule } of rows) {
    const handler = syncHandlers[source_name];
    if (!handler) {
      // Source exists in config table but has no implementation yet (e.g. Wave 4+).
      console.log(JSON.stringify({
        level: "info",
        message: "scheduler_no_handler",
        source: source_name
      }));
      continue;
    }

    if (!cron.validate(schedule)) {
      console.warn(JSON.stringify({
        level: "warn",
        message: "scheduler_invalid_cron",
        source: source_name,
        schedule
      }));
      continue;
    }

    cron.schedule(schedule, async () => {
      console.log(JSON.stringify({ level: "info", message: "scheduler_sync_start", source: source_name }));
      try {
        const result = await handler();
        console.log(JSON.stringify({
          level: "info",
          message: "scheduler_sync_done",
          source: source_name,
          processed: result.processed,
          status: result.status ?? "ok"
        }));
      } catch (err) {
        console.error(JSON.stringify({
          level: "error",
          message: "scheduler_sync_error",
          source: source_name,
          error: String(err)
        }));
      }
    });

    console.log(JSON.stringify({
      level: "info",
      message: "scheduler_registered",
      source: source_name,
      schedule
    }));
    registered++;
  }

  console.log(JSON.stringify({
    level: "info",
    message: "scheduler_started",
    jobs_registered: registered
  }));

  // --- Helix agent schedules ---

  // SLA Monitor — every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    slaMonitorAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "sla-monitor", error: String(err) }))
    );
  });

  // Incident First-Response — every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    incidentFirstResponseAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "incident-first-response", error: String(err) }))
    );
  });

  // Weekly Status Report — every Monday at 07:00
  cron.schedule("0 7 * * 1", () => {
    statusReportAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "status-report", error: String(err) }))
    );
  });

  // Post-Incident Doc Generator — every hour
  cron.schedule("0 * * * *", () => {
    postIncidentDocAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "post-incident-doc", error: String(err) }))
    );
  });

  console.log(JSON.stringify({ level: "info", message: "helix_agents_scheduled", agents: 4 }));
}
