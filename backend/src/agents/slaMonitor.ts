/**
 * Agent 8 — SLA Monitor (SDM role)
 *
 * Observes: open incidents with SLA records where target_hours is approaching
 *           or has been breached.
 * Reasons:  identifies which incidents need escalation or notification.
 * Acts:     marks breached SLA records in the DB (auto), creates approval
 *           requests for outbound notifications.
 * Reports:  SLA health summary with breach details and recommended escalations.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

interface SlaRow {
  sla_id: string;
  incident_id: string;
  sla_type: string;
  target_hours: number;
  actual_hours: number | null;
  breached: boolean;
  created_at: string;
  customer_id: string | null;
}

export class SlaMonitorAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-08-sla-monitor",
      name: "SLA Monitor",
      role: "SDM",
      systemPrompt: `You are the SLA Monitor agent for a Cisco service delivery team.
Your goal is to track SLA compliance across all incidents, identify breaches and
at-risk SLAs, and recommend escalation or mitigation actions.
Be factual, precise, and prioritise by business impact.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    // Get all open SLA records with elapsed time
    const result = await pool.query<SlaRow>(`
      SELECT
        s.sla_id,
        s.incident_id,
        s.sla_type,
        s.target_hours,
        s.actual_hours,
        s.breached,
        s.created_at,
        s.customer_id,
        EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 AS elapsed_hours
      FROM mgm.sla_records s
      WHERE s.resolved_at IS NULL
      ORDER BY s.created_at ASC
    `);

    const rows = result.rows;
    const breached = rows.filter(r => r.breached);
    const atRisk = rows.filter(r => {
      if (r.breached) return false;
      // Consider at-risk if >80% of target elapsed
      const elapsed = parseFloat(String((r as SlaRow & { elapsed_hours: string }).elapsed_hours ?? "0"));
      return elapsed / r.target_hours >= 0.8;
    });

    return {
      data: {
        total_open: rows.length,
        breached_count: breached.length,
        at_risk_count: atRisk.length,
        breached,
        at_risk: atRisk,
      },
      summary: `${rows.length} open SLA records. ${breached.length} breached, ${atRisk.length} at risk (>80% of target elapsed).`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "mark_breached") {
        const ids = action.payload["sla_ids"] as string[];
        if (ids && ids.length > 0) {
          await pool.query(
            `UPDATE mgm.sla_records
             SET breached = TRUE, breach_reason = 'Auto-detected by SLA Monitor agent'
             WHERE sla_id = ANY($1::uuid[]) AND breached = FALSE`,
            [ids]
          );
          done.push(`Marked ${ids.length} SLA record(s) as breached.`);
        }
      }
    }

    return done;
  }
}

export const slaMonitorAgent = new SlaMonitorAgent();
