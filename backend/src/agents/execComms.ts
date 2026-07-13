/**
 * Agent 12 — Executive Communications Drafting Agent (SDM/CSM role)
 *
 * On-demand agent — not cron-scheduled. Triggered manually (or by another
 * agent/event in the future, e.g. an SLA breach or escalation) via
 * POST /api/agents/run with input:
 *   { audience: "customer_exec" | "internal_leadership", topic?: string,
 *     incidentId?: string, customerId?: string }
 *
 * Observes: grounds the draft in real data — a specific incident, a specific
 *           customer's health/VoC/SLA standing, or (with no input) a generic
 *           snapshot of current open P1/P2 incidents and at-risk SLAs.
 * Reasons:  LLM decides whether enough context exists to draft, and proposes
 *           a single `draft_comms` action (auto — drafting itself is
 *           low-risk; only the eventual send would need approval, and no
 *           send capability exists yet since the Webex client only supports
 *           room creation, not message posting).
 * Acts:     drafts the actual communication text via the LLM, tailored to
 *           the requested audience. The draft is returned in the job's
 *           `actions_taken` / final report — there is no dedicated
 *           "communications" table in this schema, so we don't invent one
 *           just to store what the base agent job history already persists.
 * Reports:  the report's `actions_taken` array contains the full draft.
 *
 * No external API dependencies — reads only from mgm.incidents,
 * mgm.incident_updates, mgm.customer_health_scores, mgm.voc_signals, and
 * mgm.sla_records, all already present in this database. Uses the LLM only
 * for drafting, same as every other Helix agent.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

interface ExecCommsInput {
  audience?: string;
  topic?: string;
  incidentId?: string;
  customerId?: string;
}

export class ExecCommsAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-12-exec-comms",
      name: "Executive Communications Drafting Agent",
      role: "SDM",
      systemPrompt: `You are the Executive Communications Drafting agent for a Cisco service
delivery team. Your goal is to draft clear, audience-appropriate executive communications
(customer-facing executive briefs or internal leadership updates) grounded strictly in the
facts provided. Never invent data points. Match tone to audience: customer-facing drafts are
diplomatic and reassuring even when delivering bad news; internal leadership drafts are blunt
and action-oriented. Every draft must always be treated as a draft pending human review before
it is sent to anyone.`,
    });
  }

  async observe(input: Record<string, unknown>): Promise<ObserveResult> {
    const { audience, topic, incidentId, customerId } = input as ExecCommsInput;

    if (incidentId) {
      const incidentResult = await pool.query(`
        SELECT
          i.incident_id, i.incident_number, i.title, i.description, i.priority,
          i.status, i.created_at, i.updated_at,
          COALESCE(
            json_agg(
              json_build_object('content', u.content, 'created_at', u.created_at)
              ORDER BY u.created_at
            ) FILTER (WHERE u.update_id IS NOT NULL),
            '[]'
          ) AS updates
        FROM mgm.incidents i
        LEFT JOIN mgm.incident_updates u ON u.incident_id = i.incident_id
        WHERE i.incident_id = $1
        GROUP BY i.incident_id
      `, [incidentId]);

      if (incidentResult.rowCount === 0) {
        return {
          data: { context_type: "incident", found: false, incidentId },
          summary: `No incident found with id ${incidentId}. Cannot draft communications without grounding data.`,
        };
      }

      return {
        data: { context_type: "incident", audience, topic, incident: incidentResult.rows[0] },
        summary: `Drafting ${audience ?? "unspecified-audience"} communication about incident ${incidentResult.rows[0].incident_number ?? incidentId}.`,
      };
    }

    if (customerId) {
      const [healthResult, vocResult, slaResult] = await Promise.all([
        pool.query(
          `SELECT customer_id, customer_name, health_score, adoption_score, engagement_score, risk_level, last_updated
           FROM mgm.customer_health_scores WHERE customer_id = $1 ORDER BY last_updated DESC LIMIT 1`,
          [customerId]
        ),
        pool.query(
          `SELECT source, sentiment_score, summary, recorded_at
           FROM mgm.voc_signals WHERE customer_id = $1 ORDER BY recorded_at DESC LIMIT 5`,
          [customerId]
        ),
        pool.query(
          `SELECT sla_type, target_hours, actual_hours, breached, created_at, resolved_at
           FROM mgm.sla_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [customerId]
        ),
      ]);

      return {
        data: {
          context_type: "customer",
          audience,
          topic,
          customerId,
          health: healthResult.rows[0] ?? null,
          recent_voc: vocResult.rows,
          recent_sla: slaResult.rows,
        },
        summary: `Drafting ${audience ?? "unspecified-audience"} communication for customer ${customerId} ` +
          `(${healthResult.rowCount} health record, ${vocResult.rowCount} VoC signal(s), ${slaResult.rowCount} SLA record(s) found).`,
      };
    }

    // No specific incident/customer given — fall back to a generic snapshot
    // so the agent can still draft a general leadership update on demand.
    const [openHighSeverity, atRiskSla] = await Promise.all([
      pool.query(`
        SELECT incident_number, title, priority, status, created_at
        FROM mgm.incidents
        WHERE priority IN ('P1','P2') AND status NOT IN ('resolved','closed','cancelled')
        ORDER BY created_at ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT sla_type, customer_id, target_hours, actual_hours, created_at,
               EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS elapsed_hours
        FROM mgm.sla_records
        WHERE resolved_at IS NULL AND breached = FALSE
        ORDER BY created_at ASC
      `),
    ]);

    const atRisk = atRiskSla.rows.filter(r => {
      const elapsed = parseFloat(String(r.elapsed_hours ?? "0"));
      return elapsed / Number(r.target_hours) >= 0.8;
    }).slice(0, 5);

    return {
      data: {
        context_type: "generic",
        audience,
        topic,
        open_high_severity_incidents: openHighSeverity.rows,
        at_risk_sla: atRisk,
      },
      summary: `Drafting ${audience ?? "unspecified-audience"} generic update. ` +
        `${openHighSeverity.rowCount} open P1/P2 incident(s), ${atRisk.length} at-risk SLA(s) found.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "draft_comms") {
        const { audience, topic, context } = action.payload as {
          audience?: string;
          topic?: string;
          context?: string;
        };

        const draft = await this.llm(`
Draft an executive communication for the following audience: ${audience ?? "internal leadership"}.
${topic ? `Topic: ${topic}` : ""}

Grounding context:
${context ?? "No additional context was provided."}

Format as a short, professional message (not a full report) with:
- A clear subject line
- 2-4 concise paragraphs
- A closing line inviting follow-up questions

This is a DRAFT pending human review — do not claim it has been sent.
`);
        done.push(draft);
      }
    }

    return done;
  }
}

export const execCommsAgent = new ExecCommsAgent();
