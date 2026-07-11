import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config.js";
import { pool } from "./db.js";
import { redis } from "./redis.js";
import { ensureIntegrationSourcesTable } from "./routes/sourceAdmin.js";
import { startScheduler } from "./jobs/scheduler.js";
import { ensurePsirtAdvisoriesTable } from "./migrations/004_psirt_advisories.js";
import { ensureFieldNoticesTable } from "./migrations/005_field_notices.js";
import { ensureCustomerHealthScoresTable } from "./migrations/006_customer_health_scores.js";
import { ensureSlaRecordsTable } from "./migrations/007_sla_records.js";
import { ensureVocSignalsTable } from "./migrations/008_voc_signals.js";
import { ensureRaidItemsTable } from "./migrations/009_raid_items.js";
import { ensurePostIncidentDocsTable } from "./migrations/010_post_incident_docs.js";
import { ensureJourneyMilestonesTable } from "./migrations/011_journey_milestones.js";
import { ensureAuditEventsTable } from "./migrations/012_audit_events.js";
import { ensureAgentJobsTable } from "./migrations/013_agent_jobs.js";

async function bootstrap() {
  await pool.query("SELECT 1");
  await redis.connect().catch(() => undefined);

  // One-time startup tasks: ensure schema and seed data are in place
  await ensureIntegrationSourcesTable();
  await ensurePsirtAdvisoriesTable();
  await ensureFieldNoticesTable();
  await ensureCustomerHealthScoresTable();
  await ensureSlaRecordsTable();
  await ensureVocSignalsTable();
  await ensureRaidItemsTable();
  await ensurePostIncidentDocsTable();
  await ensureJourneyMilestonesTable();
  await ensureAuditEventsTable();
  await ensureAgentJobsTable();

  // Register cron jobs for all enabled integration sources
  await startScheduler();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(JSON.stringify({ level: "info", message: "backend_started", port: env.PORT }));
  });
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: "bootstrap_failed", error: String(error) }));
  process.exit(1);
});
