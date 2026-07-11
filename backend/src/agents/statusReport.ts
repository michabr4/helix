/**
 * Agent 1 — Status Report (SDM role)
 *
 * Observes: incidents, devices, SLA records, PSIRT advisories, VoC signals.
 * Reasons:  synthesises cross-domain health into an executive status report.
 * Acts:     no write actions — report only (auto-approved).
 * Reports:  weekly/on-demand status report as structured JSON.
 *
 * Triggered by scheduler (weekly) or manually via POST /api/agents/run.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

export class StatusReportAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-01-status-report",
      name: "Status Report",
      role: "SDM",
      systemPrompt: `You are the Status Report agent for a Cisco service delivery team.
Your role is to synthesise operational data into a concise, executive-level
weekly status report. Cover: incidents, SLAs, device health, security advisories,
and customer sentiment. Be factual, highlight risks, and recommend focus areas.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [incidents, sla, devices, psirt, voc] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM mgm.incidents
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY status
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE breached) AS breached,
          COUNT(*) FILTER (WHERE NOT breached AND resolved_at IS NULL) AS open,
          COUNT(*) AS total
        FROM mgm.sla_records
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM mgm.devices
        GROUP BY status
      `),
      pool.query(`
        SELECT severity, COUNT(*) as count
        FROM mgm.psirt_advisories
        WHERE status = 'active'
        GROUP BY severity
      `),
      pool.query(`
        SELECT AVG(sentiment_score)::numeric(4,2) AS avg_score, COUNT(*) AS total
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '7 days'
      `),
    ]);

    return {
      data: {
        incidents: incidents.rows,
        sla: sla.rows[0] ?? { breached: 0, open: 0, total: 0 },
        devices: devices.rows,
        psirt: psirt.rows,
        voc: voc.rows[0] ?? { avg_score: null, total: 0 },
      },
      summary: `Weekly snapshot: incidents by status, SLA compliance, device health, ${psirt.rows.length} active PSIRT severity groups, VoC avg ${voc.rows[0]?.avg_score ?? "N/A"}/10.`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Status report is read-only — no write actions
    return ["Generated read-only status report."];
  }
}

export const statusReportAgent = new StatusReportAgent();
