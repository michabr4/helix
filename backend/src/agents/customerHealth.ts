/**
 * Agent 4 — Customer Health Scoring Agent (CSM/SDM role)
 *
 * Observes: aggregates VoC sentiment (mgm.voc_signals) and SLA compliance
 *           (mgm.sla_records) per customer_id.
 * Reasons:  base LLM reasoning decides whether the computed scores warrant
 *           a refresh write (always yes if any customer has data).
 * Acts:     recomputes and replaces each customer's row in
 *           mgm.customer_health_scores (auto — this is a routine metric
 *           refresh, not a customer-facing action).
 * Reports:  summary of scores written and risk-level distribution.
 *
 * This agent is the sole writer of mgm.customer_health_scores in the
 * codebase today (routes/cx.ts only reads it) — nothing else keeps this
 * table fresh.
 *
 * Data-availability note: the original plan for this agent also calls for
 * "case volume/severity" and "escalation history" as scoring inputs. Those
 * live in mgm.incidents, which is keyed by property_id (UUID FK to
 * mgm.properties) — a completely separate identity space from the
 * customer_id (free-form TEXT) used by mgm.voc_signals, mgm.sla_records,
 * and mgm.customer_health_scores itself. There is no mapping table between
 * the two, so joining incident data into a customer_id-keyed score would
 * require guessing a correspondence. Rather than fabricate that join, this
 * agent computes health_score from the two components that ARE genuinely
 * keyed by customer_id: SLA compliance % and VoC sentiment. This gap is
 * reported explicitly in the agent's output.
 *
 * No external API dependencies — reads only from mgm.voc_signals and
 * mgm.sla_records, writes only to mgm.customer_health_scores, all already
 * present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const VOC_WINDOW_DAYS = 60;
const GREEN_THRESHOLD = 70;
const YELLOW_THRESHOLD = 40;

interface VocAggRow {
  customer_id: string;
  customer_name: string | null;
  avg_sentiment: string;
  signal_count: string;
}

interface SlaAggRow {
  customer_id: string;
  total: string;
  breached: string;
}

interface CustomerScoreInput {
  customer_id: string;
  customer_name: string;
  sla_compliance_pct: number | null;
  voc_engagement_score: number | null;
}

interface ComputedScore {
  customer_id: string;
  customer_name: string;
  health_score: number;
  engagement_score: number;
  risk_level: "green" | "yellow" | "red";
}

function riskLevelFor(score: number): "green" | "yellow" | "red" {
  if (score >= GREEN_THRESHOLD) return "green";
  if (score >= YELLOW_THRESHOLD) return "yellow";
  return "red";
}

function computeScore(input: CustomerScoreInput): ComputedScore | null {
  const { sla_compliance_pct, voc_engagement_score } = input;
  if (sla_compliance_pct == null && voc_engagement_score == null) return null;

  // Weight both components equally when both are present; otherwise use
  // whichever single component is available.
  let health: number;
  if (sla_compliance_pct != null && voc_engagement_score != null) {
    health = sla_compliance_pct * 0.5 + voc_engagement_score * 0.5;
  } else {
    health = (sla_compliance_pct ?? voc_engagement_score) as number;
  }
  health = Math.round(health * 100) / 100;

  return {
    customer_id: input.customer_id,
    customer_name: input.customer_name,
    health_score: Math.max(0, Math.min(100, Math.round(health))),
    engagement_score: voc_engagement_score != null ? Math.round(voc_engagement_score) : 0,
    risk_level: riskLevelFor(health),
  };
}

export class CustomerHealthAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-04-customer-health",
      name: "Customer Health Scoring Agent",
      role: "CSM",
      systemPrompt: `You are the Customer Health Scoring agent for a Cisco service delivery team.
Your goal is to keep composite customer health scores fresh based on SLA compliance and VoC
sentiment data. Be factual — never adjust a score without a data-backed reason.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [vocResult, slaResult] = await Promise.all([
      pool.query<VocAggRow>(`
        SELECT customer_id, customer_name, AVG(sentiment_score)::text AS avg_sentiment, COUNT(*) AS signal_count
        FROM mgm.voc_signals
        WHERE customer_id IS NOT NULL AND recorded_at >= NOW() - INTERVAL '${VOC_WINDOW_DAYS} days'
        GROUP BY customer_id, customer_name
      `),
      pool.query<SlaAggRow>(`
        SELECT customer_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE breached = TRUE) AS breached
        FROM mgm.sla_records
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
      `),
    ]);

    const merged = new Map<string, CustomerScoreInput>();

    for (const row of vocResult.rows) {
      merged.set(row.customer_id, {
        customer_id: row.customer_id,
        customer_name: row.customer_name ?? row.customer_id,
        sla_compliance_pct: null,
        voc_engagement_score: Math.round((Number(row.avg_sentiment) / 10) * 100),
      });
    }

    for (const row of slaResult.rows) {
      const total = Number(row.total);
      const breached = Number(row.breached);
      const compliancePct = total > 0 ? ((total - breached) / total) * 100 : null;
      const existing = merged.get(row.customer_id);
      if (existing) {
        existing.sla_compliance_pct = compliancePct;
      } else {
        merged.set(row.customer_id, {
          customer_id: row.customer_id,
          customer_name: row.customer_id,
          sla_compliance_pct: compliancePct,
          voc_engagement_score: null,
        });
      }
    }

    const computed = Array.from(merged.values())
      .map(computeScore)
      .filter((s): s is ComputedScore => s !== null);

    const riskCounts = {
      green: computed.filter(s => s.risk_level === "green").length,
      yellow: computed.filter(s => s.risk_level === "yellow").length,
      red: computed.filter(s => s.risk_level === "red").length,
    };

    return {
      data: {
        computed_scores: computed,
        risk_counts: riskCounts,
        data_gaps: [
          "case volume/severity and escalation history omitted — mgm.incidents is keyed by " +
            "property_id, not the customer_id used by mgm.voc_signals/mgm.sla_records/" +
            "mgm.customer_health_scores, and no mapping table exists between the two.",
        ],
      },
      summary: `Computed health scores for ${computed.length} customer(s) with SLA and/or VoC data. ` +
        `${riskCounts.red} red, ${riskCounts.yellow} yellow, ${riskCounts.green} green.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "recompute_health_scores") {
        const scores = (action.payload["scores"] as ComputedScore[] | undefined) ?? [];

        for (const score of scores) {
          await pool.query(`DELETE FROM mgm.customer_health_scores WHERE customer_id = $1`, [score.customer_id]);
          await pool.query(
            `INSERT INTO mgm.customer_health_scores
             (customer_id, customer_name, health_score, adoption_score, engagement_score, risk_level)
             VALUES ($1, $2, $3, 0, $4, $5)`,
            [score.customer_id, score.customer_name, score.health_score, score.engagement_score, score.risk_level]
          );
        }

        if (scores.length > 0) {
          done.push(`Refreshed health scores for ${scores.length} customer(s).`);
        }
      }
    }

    return done;
  }
}

export const customerHealthAgent = new CustomerHealthAgent();
