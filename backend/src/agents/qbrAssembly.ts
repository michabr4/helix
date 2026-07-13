/**
 * Agent 3 — QBR/EBR Content Assembly Agent (SDM/CSM role)
 *
 * Observes: upcoming quarterly/annual business reviews (mgm.qbr_schedule)
 *           within a preparation window that don't have content assembled
 *           yet, grounding each in that customer's latest health score,
 *           recent VoC signals, SLA compliance history, and — when the
 *           schedule row references a property — that property's recent
 *           high-severity incidents and technology/license adoption.
 * Reasons:  base LLM reasoning proposes a single `assemble_qbr_content`
 *           action per upcoming review (auto — assembling a draft is
 *           low-risk; only the eventual delivery to the customer is a
 *           separate human action).
 * Acts:     drafts the QBR content via the LLM and persists it back onto
 *           the mgm.qbr_schedule row (generated_content, generated_at,
 *           status='content_ready') so an SDM can retrieve and review it
 *           before the actual review meeting.
 * Reports:  summary of which upcoming reviews got content assembled.
 *
 * Data-availability note: like Agent 4 (Customer Health Scoring) and
 * Agent 12 (Exec Comms), this agent is keyed by the free-form TEXT
 * customer_id used by mgm.customer_health_scores/mgm.voc_signals/
 * mgm.sla_records. Incident and adoption/license data (keyed by property_id)
 * is only included when a schedule row has an explicit property_id set;
 * there is no mapping table to infer one otherwise. This gap is reported
 * explicitly per review in the agent's output.
 *
 * No external API dependencies — reads only from mgm.qbr_schedule,
 * mgm.customer_health_scores, mgm.voc_signals, mgm.sla_records,
 * mgm.incidents, mgm.property_technology_adoption, and
 * mgm.property_license_usage, all already present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const PREP_WINDOW_DAYS = 14;

interface QbrScheduleRow {
  qbr_id: string;
  customer_id: string;
  customer_name: string;
  property_id: string | null;
  scheduled_date: string;
  cadence: string;
}

export class QbrAssemblyAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-03-qbr-ebr-content-assembly",
      name: "QBR/EBR Content Assembly Agent",
      role: "CSM",
      systemPrompt: `You are the QBR/EBR Content Assembly agent for a Cisco service delivery
team. Your goal is to assemble a factual, data-grounded draft for an upcoming Quarterly or
Executive Business Review — summarizing customer health trend, SLA compliance, notable VoC
themes, and (when available) recent incident and technology adoption activity. Never invent
data points not present in the provided context. Always label the output as a draft pending
SDM/CSM review before the actual meeting.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const upcomingResult = await pool.query<QbrScheduleRow>(
      `SELECT qbr_id, customer_id, customer_name, property_id, scheduled_date::text AS scheduled_date, cadence
       FROM mgm.qbr_schedule
       WHERE status = 'scheduled'
         AND scheduled_date <= CURRENT_DATE + INTERVAL '${PREP_WINDOW_DAYS} days'
       ORDER BY scheduled_date ASC`
    );

    const reviews = await Promise.all(
      upcomingResult.rows.map(async row => {
        const [healthResult, vocResult, slaResult] = await Promise.all([
          pool.query(
            `SELECT health_score, adoption_score, engagement_score, risk_level, last_updated
             FROM mgm.customer_health_scores WHERE customer_id = $1 ORDER BY last_updated DESC LIMIT 1`,
            [row.customer_id]
          ),
          pool.query(
            `SELECT source, sentiment_score, summary, recorded_at
             FROM mgm.voc_signals WHERE customer_id = $1 ORDER BY recorded_at DESC LIMIT 5`,
            [row.customer_id]
          ),
          pool.query(
            `SELECT sla_type, target_hours, actual_hours, breached, created_at, resolved_at
             FROM mgm.sla_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [row.customer_id]
          ),
        ]);

        let propertyContext: {
          recent_incidents: unknown[];
          technology_adoption: unknown[];
          license_utilization: unknown[];
        } | null = null;

        if (row.property_id) {
          const [incidentsResult, adoptionResult, licenseResult] = await Promise.all([
            pool.query(
              `SELECT incident_number, title, priority, status, created_at
               FROM mgm.incidents
               WHERE property_id = $1 AND priority IN ('P1','P2')
                 AND created_at >= NOW() - INTERVAL '90 days'
               ORDER BY created_at DESC LIMIT 10`,
              [row.property_id]
            ),
            pool.query(
              `SELECT t.name AS technology_name, a.deployment_phase, a.devices_deployed, a.health_status
               FROM mgm.property_technology_adoption a
               JOIN cisco.technologies t ON t.technology_id = a.technology_id
               WHERE a.property_id = $1`,
              [row.property_id]
            ),
            pool.query(
              `SELECT l.product_name, u.quantity_used, l.quantity_purchased
               FROM mgm.property_license_usage u
               JOIN cisco.licenses l ON l.license_id = u.license_id
               WHERE u.property_id = $1`,
              [row.property_id]
            ),
          ]);

          propertyContext = {
            recent_incidents: incidentsResult.rows,
            technology_adoption: adoptionResult.rows,
            license_utilization: licenseResult.rows,
          };
        }

        return {
          qbr_id: row.qbr_id,
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          property_id: row.property_id,
          scheduled_date: row.scheduled_date,
          cadence: row.cadence,
          health: healthResult.rows[0] ?? null,
          recent_voc: vocResult.rows,
          recent_sla: slaResult.rows,
          property_context: propertyContext,
        };
      })
    );

    return {
      data: {
        prep_window_days: PREP_WINDOW_DAYS,
        upcoming_reviews: reviews,
        data_gaps: reviews
          .filter(r => r.property_id == null)
          .map(r => `${r.customer_name} (${r.qbr_id}): no property_id set on this schedule row, so recent incident and technology adoption data could not be included.`),
      },
      summary: `${reviews.length} upcoming QBR/EBR(s) within the next ${PREP_WINDOW_DAYS} days need content assembled.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "assemble_qbr_content") {
        const { qbrId, customerName, context } = action.payload as {
          qbrId?: string;
          customerName?: string;
          context?: string;
        };

        if (!qbrId) continue;

        const draft = await this.llm(`
Assemble a Quarterly/Executive Business Review draft for customer "${customerName ?? "unknown"}".

Grounding context (health score, VoC, SLA, and — if available — incident/adoption data):
${context ?? "No additional context was provided."}

Format as a structured draft with sections:
- Executive Summary
- Health & Engagement Trend
- SLA Compliance
- Voice of Customer Themes
- Recent Incidents & Technology Adoption (if data provided)
- Recommended Discussion Topics

This is a DRAFT pending SDM/CSM review before the actual meeting.
`);

        await pool.query(
          `UPDATE mgm.qbr_schedule
           SET generated_content = $1, generated_at = NOW(), status = 'content_ready', updated_at = NOW()
           WHERE qbr_id = $2`,
          [draft, qbrId]
        );

        done.push(`Assembled QBR content for ${customerName ?? qbrId} (qbr_id=${qbrId}).`);
      }
    }

    return done;
  }
}

export const qbrAssemblyAgent = new QbrAssemblyAgent();
