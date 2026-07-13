/**
 * Agent 16 — Resource Utilization Agent (PM/PgM/SDM role)
 *
 * Observes: open incident assignment distribution per engineer (rolling 30-day
 *           window) and open RAID item ownership.
 * Reasons:  flags engineers carrying a disproportionate share of high-severity
 *           (P1/P2) work relative to their own open load, and surfaces demand
 *           peaks across the team.
 * Acts:     read-only — no destructive/write actions. Any human-facing
 *           notification recommended by the LLM is queued for approval via
 *           the base agent's `requestApproval` flow.
 * Reports:  workload summary with overloaded-engineer flags and demand peaks.
 *
 * No external API dependencies — reads only from mgm.incidents, mgm.users,
 * and mgm.raid_items, all already present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const ROLLING_WINDOW_DAYS = 30;
const OVERLOAD_THRESHOLD = 0.8; // >80% of an engineer's open load is P1/P2
const MIN_LOAD_FOR_FLAG = 3; // ignore engineers with too few incidents to be meaningful

interface EngineerLoadRow {
  user_id: string;
  full_name: string;
  total_open: string;
  high_severity_open: string;
}

interface RaidOwnerRow {
  owner: string;
  open_items: string;
}

export class ResourceUtilizationAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-16-resource-utilization",
      name: "Resource Utilization Agent",
      role: "PgM",
      systemPrompt: `You are the Resource Utilization agent for a Cisco service delivery team.
Your goal is to monitor engineer workload distribution, flag overloaded engineers
carrying a disproportionate share of high-severity (P1/P2) incidents, and surface
demand peaks so managers can rebalance assignments before burnout or SLA risk occurs.
Be factual and specific — cite names, counts, and percentages.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const loadResult = await pool.query<EngineerLoadRow>(
      `SELECT
         u.user_id,
         u.full_name,
         COUNT(i.incident_id) AS total_open,
         COUNT(i.incident_id) FILTER (WHERE i.priority IN ('P1','P2')) AS high_severity_open
       FROM mgm.users u
       JOIN mgm.incidents i ON i.assigned_to = u.user_id
       WHERE i.status NOT IN ('resolved','closed','cancelled')
         AND i.created_at >= NOW() - INTERVAL '${ROLLING_WINDOW_DAYS} days'
       GROUP BY u.user_id, u.full_name
       HAVING COUNT(i.incident_id) > 0
       ORDER BY high_severity_open DESC, total_open DESC`
    );

    const raidResult = await pool.query<RaidOwnerRow>(
      `SELECT owner, COUNT(*) AS open_items
       FROM mgm.raid_items
       WHERE status = 'open' AND owner IS NOT NULL AND owner != ''
       GROUP BY owner
       ORDER BY open_items DESC`
    );

    const engineers = loadResult.rows.map(r => {
      const total = Number(r.total_open);
      const highSeverity = Number(r.high_severity_open);
      const ratio = total > 0 ? highSeverity / total : 0;
      return {
        user_id: r.user_id,
        full_name: r.full_name,
        total_open: total,
        high_severity_open: highSeverity,
        high_severity_ratio: Math.round(ratio * 100) / 100,
      };
    });

    const overloaded = engineers.filter(
      e => e.high_severity_ratio >= OVERLOAD_THRESHOLD && e.total_open >= MIN_LOAD_FOR_FLAG
    );

    const raidLoad = raidResult.rows.map(r => ({
      owner: r.owner,
      open_items: Number(r.open_items),
    }));

    const totalOpenIncidents = engineers.reduce((sum, e) => sum + e.total_open, 0);
    const avgLoad = engineers.length > 0 ? totalOpenIncidents / engineers.length : 0;
    const demandPeaks = engineers.filter(e => avgLoad > 0 && e.total_open >= avgLoad * 1.5);

    return {
      data: {
        window_days: ROLLING_WINDOW_DAYS,
        engineers,
        overloaded_engineers: overloaded,
        demand_peaks: demandPeaks,
        average_open_load: Math.round(avgLoad * 100) / 100,
        raid_ownership: raidLoad,
      },
      summary:
        `${engineers.length} engineer(s) with open assignments in the last ${ROLLING_WINDOW_DAYS} days. ` +
        `${overloaded.length} flagged as overloaded (>=${Math.round(OVERLOAD_THRESHOLD * 100)}% P1/P2 share, ` +
        `>=${MIN_LOAD_FOR_FLAG} open incidents). ${demandPeaks.length} demand peak(s) detected (load >=1.5x team average).`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes. Notification-style recommendations
    // from reason() are routed through requestApproval() by the base run() loop.
    return [];
  }
}

export const resourceUtilizationAgent = new ResourceUtilizationAgent();
