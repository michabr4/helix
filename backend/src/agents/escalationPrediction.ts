/**
 * Agent 7 — Escalation Prediction Agent (SDM role)
 *
 * Observes: open incidents (mgm.incidents) that are aging relative to the
 *           historical average resolution time for their priority, or that
 *           have gone stale (no mgm.incident_updates activity for a while),
 *           or that have accumulated child incidents (via
 *           parent_incident_id) suggesting a widening/spreading issue.
 * Reasons:  flags incidents at elevated risk of escalating to a higher
 *           priority or breaching customer expectations before that
 *           actually happens, so an SDM can intervene proactively.
 * Acts:     read-only — no destructive/write actions. Any human-facing
 *           notification recommended by the LLM is queued for approval via
 *           the base agent's `requestApproval` flow.
 * Reports:  escalation-risk summary with aging, stale, and widening-impact
 *           incidents.
 *
 * This agent is distinct from Agent 8 (SLA Monitor), which tracks explicit
 * SLA target breaches on mgm.sla_records. This agent predicts escalation
 * risk from incident behavior signals even when no formal SLA record
 * exists yet.
 *
 * No external API dependencies — reads only from mgm.incidents and
 * mgm.incident_updates, both already present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const STALE_HOURS = 24; // no update activity in this many hours while open
const AGING_RATIO_THRESHOLD = 1.5; // open >=1.5x the avg resolution time for its priority
const MIN_HISTORICAL_SAMPLES = 3; // require this many closed incidents per priority before comparing
const WIDENING_CHILD_THRESHOLD = 2; // >=2 child incidents suggests a spreading issue

interface AvgResolutionRow {
  priority: string;
  avg_hours: string;
  sample_count: string;
}

interface OpenIncidentRow {
  incident_id: string;
  incident_number: string | null;
  title: string;
  priority: string;
  status: string;
  property_id: string;
  created_at: string;
  open_hours: string;
  last_update_at: string | null;
  child_count: string;
}

export class EscalationPredictionAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-07-escalation-prediction",
      name: "Escalation Prediction Agent",
      role: "SDM",
      systemPrompt: `You are the Escalation Prediction agent for a Cisco service delivery team.
Your goal is to identify open incidents at elevated risk of escalating to a higher
priority or breaching customer expectations, based on how long they've been open
relative to historical norms, how stale their activity is, and whether they have
spawned child incidents suggesting a widening issue. Be factual — cite incident
numbers, elapsed hours, and concrete thresholds.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const avgResult = await pool.query<AvgResolutionRow>(`
      SELECT
        priority,
        AVG(EXTRACT(EPOCH FROM resolution_time) / 3600)::text AS avg_hours,
        COUNT(*)::text AS sample_count
      FROM mgm.incidents
      WHERE status IN ('resolved', 'closed') AND resolution_time IS NOT NULL
      GROUP BY priority
    `);

    const avgByPriority = new Map<string, number>();
    for (const row of avgResult.rows) {
      if (Number(row.sample_count) >= MIN_HISTORICAL_SAMPLES) {
        avgByPriority.set(row.priority, Number(row.avg_hours));
      }
    }

    const openResult = await pool.query<OpenIncidentRow>(`
      SELECT
        i.incident_id,
        i.incident_number,
        i.title,
        i.priority,
        i.status,
        i.property_id,
        i.created_at,
        EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600 AS open_hours,
        (SELECT MAX(u.created_at) FROM mgm.incident_updates u WHERE u.incident_id = i.incident_id) AS last_update_at,
        (SELECT COUNT(*) FROM mgm.incidents c WHERE c.parent_incident_id = i.incident_id)::text AS child_count
      FROM mgm.incidents i
      WHERE i.status NOT IN ('resolved','closed','cancelled')
      ORDER BY i.created_at ASC
    `);

    const now = Date.now();

    const enriched = openResult.rows.map(r => {
      const openHours = Number((r as unknown as { open_hours: string }).open_hours);
      const avgForPriority = avgByPriority.get(r.priority) ?? null;
      const agingRatio = avgForPriority != null && avgForPriority > 0 ? openHours / avgForPriority : null;
      const staleHours = r.last_update_at
        ? (now - new Date(r.last_update_at).getTime()) / 3_600_000
        : openHours;
      const childCount = Number(r.child_count);

      return {
        incident_id: r.incident_id,
        incident_number: r.incident_number,
        title: r.title,
        priority: r.priority,
        status: r.status,
        property_id: r.property_id,
        open_hours: Math.round(openHours * 10) / 10,
        avg_resolution_hours_for_priority: avgForPriority != null ? Math.round(avgForPriority * 10) / 10 : null,
        aging_ratio: agingRatio != null ? Math.round(agingRatio * 100) / 100 : null,
        stale_hours: Math.round(staleHours * 10) / 10,
        child_incident_count: childCount,
      };
    });

    const aging = enriched.filter(
      e => e.aging_ratio != null && e.aging_ratio >= AGING_RATIO_THRESHOLD
    );
    const stale = enriched.filter(e => e.stale_hours >= STALE_HOURS);
    const widening = enriched.filter(e => e.child_incident_count >= WIDENING_CHILD_THRESHOLD);

    const atRiskIds = new Set([...aging, ...stale, ...widening].map(e => e.incident_id));

    return {
      data: {
        open_incident_count: enriched.length,
        aging_threshold_ratio: AGING_RATIO_THRESHOLD,
        stale_threshold_hours: STALE_HOURS,
        widening_child_threshold: WIDENING_CHILD_THRESHOLD,
        aging_incidents: aging,
        stale_incidents: stale,
        widening_incidents: widening,
        at_risk_incident_count: atRiskIds.size,
        data_gaps:
          avgByPriority.size === 0
            ? [
                "No priority has enough resolved-incident history " +
                  `(need >=${MIN_HISTORICAL_SAMPLES} closed incidents with resolution_time set) ` +
                  "to compute an aging baseline — aging_incidents will be empty until more incidents close.",
              ]
            : [],
      },
      summary:
        `${enriched.length} open incident(s) evaluated. ${atRiskIds.size} flagged as at risk of escalation: ` +
        `${aging.length} aging (>=${AGING_RATIO_THRESHOLD}x historical avg for priority), ` +
        `${stale.length} stale (no update in >=${STALE_HOURS}h), ` +
        `${widening.length} widening (>=${WIDENING_CHILD_THRESHOLD} child incidents).`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes. Notification-style recommendations
    // from reason() are routed through requestApproval() by the base run() loop.
    return [];
  }
}

export const escalationPredictionAgent = new EscalationPredictionAgent();
