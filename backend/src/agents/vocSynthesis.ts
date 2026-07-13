/**
 * Agent 14 — VoC Synthesis & Trend Agent (CSM/SDM role)
 *
 * Observes: aggregates mgm.voc_signals over a rolling 30-day window —
 *           overall/per-source/per-customer sentiment averages, a
 *           week-over-week trend split to detect sentiment decline, and the
 *           most recent low-sentiment ("detractor") signals.
 * Reasons:  base LLM reasoning decides whether there's enough signal volume
 *           to synthesize a themed digest.
 * Acts:     synthesizes detractor signals into a themed narrative summary
 *           via the LLM (read-only synthesis, no writes/sends — there is no
 *           dedicated VoC-digest table in this schema, so the digest is
 *           returned in the job's `actions_taken` / final report, same as
 *           the Executive Communications Drafting agent).
 * Reports:  sentiment trend summary with named themes for leadership.
 *
 * No external API dependencies — reads only from mgm.voc_signals, already
 * present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const WINDOW_DAYS = 30;
const RECENT_WINDOW_DAYS = 7;
const DECLINE_THRESHOLD = 1.0; // drop of >=1.0 point (0-10 scale) week-over-week
const DETRACTOR_MAX_SCORE = 4;

interface SourceAvgRow {
  source: string;
  avg_sentiment: string;
  signal_count: string;
}

interface CustomerAvgRow {
  customer_id: string;
  customer_name: string | null;
  avg_sentiment: string;
  signal_count: string;
}

interface PeriodAvgRow {
  avg_sentiment: string | null;
  signal_count: string;
}

interface DetractorRow {
  source: string;
  sentiment_score: string;
  summary: string;
  customer_name: string | null;
  recorded_at: string;
}

export class VocSynthesisAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-14-voc-synthesis",
      name: "VoC Synthesis & Trend Agent",
      role: "CSM",
      systemPrompt: `You are the Voice-of-Customer Synthesis agent for a Cisco service delivery team.
Your goal is to read raw customer feedback signals and synthesize them into a small number of
named, concrete themes leadership can act on. Never invent feedback that isn't in the provided
signals — quote or closely paraphrase what customers actually said. Flag sentiment decline clearly.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [bySource, byCustomer, recentPeriod, priorPeriod, detractors] = await Promise.all([
      pool.query<SourceAvgRow>(`
        SELECT source, AVG(sentiment_score)::text AS avg_sentiment, COUNT(*) AS signal_count
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '${WINDOW_DAYS} days'
        GROUP BY source
        ORDER BY AVG(sentiment_score) ASC
      `),
      pool.query<CustomerAvgRow>(`
        SELECT customer_id, customer_name, AVG(sentiment_score)::text AS avg_sentiment, COUNT(*) AS signal_count
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '${WINDOW_DAYS} days' AND customer_id IS NOT NULL
        GROUP BY customer_id, customer_name
        HAVING COUNT(*) >= 2
        ORDER BY AVG(sentiment_score) ASC
      `),
      pool.query<PeriodAvgRow>(`
        SELECT AVG(sentiment_score)::text AS avg_sentiment, COUNT(*) AS signal_count
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '${RECENT_WINDOW_DAYS} days'
      `),
      pool.query<PeriodAvgRow>(`
        SELECT AVG(sentiment_score)::text AS avg_sentiment, COUNT(*) AS signal_count
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '${WINDOW_DAYS} days'
          AND recorded_at < NOW() - INTERVAL '${RECENT_WINDOW_DAYS} days'
      `),
      pool.query<DetractorRow>(`
        SELECT source, sentiment_score::text, summary, customer_name, recorded_at
        FROM mgm.voc_signals
        WHERE recorded_at >= NOW() - INTERVAL '${WINDOW_DAYS} days' AND sentiment_score <= ${DETRACTOR_MAX_SCORE}
        ORDER BY recorded_at DESC
        LIMIT 15
      `),
    ]);

    const recentAvg = recentPeriod.rows[0]?.avg_sentiment != null
      ? Math.round(Number(recentPeriod.rows[0].avg_sentiment) * 100) / 100
      : null;
    const priorAvg = priorPeriod.rows[0]?.avg_sentiment != null
      ? Math.round(Number(priorPeriod.rows[0].avg_sentiment) * 100) / 100
      : null;
    const trendDelta = recentAvg != null && priorAvg != null
      ? Math.round((recentAvg - priorAvg) * 100) / 100
      : null;
    const sentimentDeclining = trendDelta != null && trendDelta <= -DECLINE_THRESHOLD;

    const sourceAverages = bySource.rows.map(r => ({
      source: r.source,
      avg_sentiment: Math.round(Number(r.avg_sentiment) * 100) / 100,
      signal_count: Number(r.signal_count),
    }));

    const customerAverages = byCustomer.rows.map(r => ({
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      avg_sentiment: Math.round(Number(r.avg_sentiment) * 100) / 100,
      signal_count: Number(r.signal_count),
    }));

    return {
      data: {
        window_days: WINDOW_DAYS,
        recent_period_avg_sentiment: recentAvg,
        prior_period_avg_sentiment: priorAvg,
        trend_delta: trendDelta,
        sentiment_declining: sentimentDeclining,
        by_source: sourceAverages,
        by_customer: customerAverages,
        detractor_signals: detractors.rows,
      },
      summary:
        `${detractors.rowCount} detractor signal(s) (score <= ${DETRACTOR_MAX_SCORE}) in the last ${WINDOW_DAYS} days. ` +
        `Recent ${RECENT_WINDOW_DAYS}-day avg sentiment: ${recentAvg ?? "n/a"}, prior period: ${priorAvg ?? "n/a"}` +
        (trendDelta != null ? ` (delta ${trendDelta > 0 ? "+" : ""}${trendDelta}).` : ".") +
        (sentimentDeclining ? " SENTIMENT DECLINE FLAGGED." : ""),
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "synthesize_voc_trends") {
        const { detractor_signals, sentiment_declining, trend_delta } = action.payload as {
          detractor_signals?: DetractorRow[];
          sentiment_declining?: boolean;
          trend_delta?: number | null;
        };

        const signalsText = (detractor_signals ?? [])
          .map(s => `- [${s.source}] ${s.customer_name ?? "unknown customer"} (score ${s.sentiment_score}): ${s.summary}`)
          .join("\n") || "No detractor signals in this window.";

        const digest = await this.llm(`
Synthesize the following customer feedback signals into 2-4 named themes for a leadership digest.
Sentiment trend delta (recent vs prior ${RECENT_WINDOW_DAYS}-day period): ${trend_delta ?? "unknown"}${sentiment_declining ? " — DECLINE FLAGGED" : ""}.

## Detractor signals
${signalsText}

For each theme, name it, cite how many signals support it, and suggest one concrete next step.
`);
        done.push(digest);
      }
    }

    return done;
  }
}

export const vocSynthesisAgent = new VocSynthesisAgent();
