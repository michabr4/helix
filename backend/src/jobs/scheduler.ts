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
import { resourceUtilizationAgent } from "../agents/resourceUtilization.js";
import { deliveryBenchmarkAgent } from "../agents/deliveryBenchmark.js";
import { vocSynthesisAgent } from "../agents/vocSynthesis.js";
import { customerHealthAgent } from "../agents/customerHealth.js";
import { adoptionGapAgent } from "../agents/adoptionGap.js";
import { escalationPredictionAgent } from "../agents/escalationPrediction.js";
import { renewalRiskAgent } from "../agents/renewalRisk.js";
import { changeImpactAgent } from "../agents/changeImpact.js";
import { qbrAssemblyAgent } from "../agents/qbrAssembly.js";
import { onboardingOrchestrationAgent } from "../agents/onboardingOrchestration.js";
import { financialForecastAgent } from "../agents/financialForecast.js";

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

  // Resource Utilization Agent — daily at 06:00
  cron.schedule("0 6 * * *", () => {
    resourceUtilizationAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "resource-utilization", error: String(err) }))
    );
  });

  // Delivery Performance Benchmarking Agent — monthly, 1st of month at 07:00
  cron.schedule("0 7 1 * *", () => {
    deliveryBenchmarkAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "delivery-benchmark", error: String(err) }))
    );
  });

  // VoC Synthesis & Trend Agent — weekly, every Monday at 08:00
  cron.schedule("0 8 * * 1", () => {
    vocSynthesisAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "voc-synthesis", error: String(err) }))
    );
  });

  // Customer Health Scoring Agent — weekly, every Monday at 05:00 (ahead of downstream reports)
  cron.schedule("0 5 * * 1", () => {
    customerHealthAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "customer-health", error: String(err) }))
    );
  });

  // Adoption & Utilization Gap Agent — weekly, every Wednesday at 06:00
  cron.schedule("0 6 * * 3", () => {
    adoptionGapAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "adoption-utilization-gap", error: String(err) }))
    );
  });

  // Escalation Prediction Agent — every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    escalationPredictionAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "escalation-prediction", error: String(err) }))
    );
  });

  // Renewal Risk Early Warning Agent — daily at 06:30
  cron.schedule("30 6 * * *", () => {
    renewalRiskAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "renewal-risk", error: String(err) }))
    );
  });

  // Change Impact & Communication Agent — every 2 hours
  cron.schedule("0 */2 * * *", () => {
    changeImpactAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "change-impact-communication", error: String(err) }))
    );
  });

  // QBR/EBR Content Assembly Agent — daily at 05:30
  cron.schedule("30 5 * * *", () => {
    qbrAssemblyAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "qbr-ebr-content-assembly", error: String(err) }))
    );
  });

  // Customer Onboarding Orchestration Agent — daily at 07:00
  cron.schedule("0 7 * * *", () => {
    onboardingOrchestrationAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "onboarding-orchestration", error: String(err) }))
    );
  });

  // Financial Forecast Agent — monthly, 1st of month at 08:00
  cron.schedule("0 8 1 * *", () => {
    financialForecastAgent.run().catch(err =>
      console.error(JSON.stringify({ level: "error", message: "agent_error", agent: "financial-forecast", error: String(err) }))
    );
  });

  console.log(JSON.stringify({ level: "info", message: "helix_agents_scheduled", agents: 15 }));
}
