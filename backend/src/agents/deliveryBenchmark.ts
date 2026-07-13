/**
 * Agent 19 — Delivery Performance Benchmarking Agent (PgM/HTOM role)
 *
 * Observes: Mean Time To Resolve (MTTR) per property from mgm.incidents, and
 *           SLA compliance % per customer from mgm.sla_records.
 * Reasons:  z-score outlier detection on MTTR to surface best/worst performers
 *           and a ranked league table.
 * Acts:     read-only — no destructive/write actions.
 * Reports:  league table with z-scores and best-practice callouts for
 *           top-performing properties.
 *
 * Data-availability note: the plan for this agent also calls for "on-time
 * sync %" and "CSAT" in the league table. Neither has a real data source in
 * this codebase yet — there is no sync-attempt log tracking on-time vs. late
 * runs, and no CSAT capture mechanism anywhere (not in mgm.voc_signals or
 * elsewhere). Rather than fabricate those numbers, this agent reports only
 * the two metrics that are actually backed by real tables (MTTR, SLA %) and
 * flags the gap explicitly in its output so it's visible to reviewers.
 *
 * Also note: mgm.incidents.resolution_time is never populated by any route
 * (routes/incidents.ts PATCH only ever updates `status`), so MTTR is derived
 * from `updated_at - created_at` for resolved/closed incidents instead of
 * relying on that dead column.
 *
 * No external API dependencies — reads only from mgm.incidents,
 * mgm.properties, and mgm.sla_records, all already present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

interface PropertyMttrRow {
  property_id: string;
  property_name: string;
  resolved_count: string;
  avg_resolution_hours: string | null;
}

interface CustomerSlaRow {
  customer_id: string;
  total: string;
  breached: string;
}

function computeZScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return values.map(() => 0);
  return values.map(v => Math.round(((v - mean) / stdDev) * 100) / 100);
}

export class DeliveryBenchmarkAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-19-delivery-benchmark",
      name: "Delivery Performance Benchmarking Agent",
      role: "PgM",
      systemPrompt: `You are the Delivery Performance Benchmarking agent for a Cisco service
delivery team. Your goal is to compare MTTR and SLA compliance across properties, identify
statistical outliers (both best and worst performers), and surface best practices from
top-performing properties that others can learn from. Be factual and cite exact numbers.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const mttrResult = await pool.query<PropertyMttrRow>(`
      SELECT
        p.property_id,
        p.name AS property_name,
        COUNT(i.incident_id) AS resolved_count,
        AVG(EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 3600) AS avg_resolution_hours
      FROM mgm.properties p
      JOIN mgm.incidents i ON i.property_id = p.property_id
      WHERE i.status IN ('resolved','closed')
      GROUP BY p.property_id, p.name
      HAVING COUNT(i.incident_id) > 0
      ORDER BY avg_resolution_hours DESC
    `);

    const slaResult = await pool.query<CustomerSlaRow>(`
      SELECT
        COALESCE(customer_id, 'unassigned') AS customer_id,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE breached = TRUE) AS breached
      FROM mgm.sla_records
      GROUP BY COALESCE(customer_id, 'unassigned')
      ORDER BY total DESC
    `);

    const mttrRows = mttrResult.rows.map(r => ({
      property_id: r.property_id,
      property_name: r.property_name,
      resolved_count: Number(r.resolved_count),
      avg_resolution_hours: r.avg_resolution_hours != null
        ? Math.round(Number(r.avg_resolution_hours) * 100) / 100
        : 0,
    }));

    const zScores = computeZScores(mttrRows.map(r => r.avg_resolution_hours));
    const mttrLeagueTable = mttrRows
      .map((r, i) => ({ ...r, mttr_z_score: zScores[i] }))
      .sort((a, b) => a.avg_resolution_hours - b.avg_resolution_hours);

    // Positive z-score = worse than average (higher MTTR); negative = better than average.
    const worstOutliers = mttrLeagueTable.filter(r => r.mttr_z_score >= 1.5);
    const bestPractices = mttrLeagueTable.filter(r => r.mttr_z_score <= -1.5);

    const slaCompliance = slaResult.rows.map(r => {
      const total = Number(r.total);
      const breached = Number(r.breached);
      return {
        customer_id: r.customer_id,
        total_sla_records: total,
        breached_count: breached,
        compliance_pct: total > 0 ? Math.round(((total - breached) / total) * 10000) / 100 : null,
      };
    });

    return {
      data: {
        mttr_league_table: mttrLeagueTable,
        mttr_worst_outliers: worstOutliers,
        mttr_best_practices: bestPractices,
        sla_compliance_by_customer: slaCompliance,
        data_gaps: [
          "on-time sync % omitted — no sync-attempt log table exists yet",
          "CSAT omitted — no CSAT capture mechanism exists in the platform yet",
        ],
      },
      summary:
        `MTTR computed for ${mttrLeagueTable.length} propert${mttrLeagueTable.length === 1 ? "y" : "ies"} with resolved incidents. ` +
        `${worstOutliers.length} outlier(s) with MTTR >=1.5 std dev above the mean, ` +
        `${bestPractices.length} top performer(s) with MTTR >=1.5 std dev below the mean. ` +
        `SLA compliance tracked for ${slaCompliance.length} customer(s). ` +
        `on-time sync % and CSAT are not yet trackable in this platform.`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes.
    return [];
  }
}

export const deliveryBenchmarkAgent = new DeliveryBenchmarkAgent();
