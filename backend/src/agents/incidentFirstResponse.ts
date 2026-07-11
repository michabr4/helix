/**
 * Agent 2 — Incident First-Response (SDM role)
 *
 * Observes: newly opened incidents (status = 'open', no updates yet).
 * Reasons:  triages priority, suggests acknowledgment message and assignee.
 * Acts:     auto-posts an acknowledgment update to the incident timeline.
 *           Requires approval to reassign ownership or escalate to TAC.
 * Reports:  triage summary with recommended next steps.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

interface IncidentRow {
  incident_id: string;
  incident_number: string;
  title: string;
  priority: string;
  status: string;
  description: string;
  reported_by: string;
  created_at: string;
}

export class IncidentFirstResponseAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-02-incident-first-response",
      name: "Incident First-Response",
      role: "SDM",
      systemPrompt: `You are the Incident First-Response agent for a Cisco service delivery team.
Your role is to triage newly reported incidents, draft acknowledgment messages,
and recommend initial response actions. Prioritise by P1/P2 severity.
Be empathetic, clear, and actionable in communications.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    // Find incidents opened in the last 30 minutes with no updates
    const result = await pool.query<IncidentRow>(`
      SELECT i.incident_id, i.incident_number, i.title, i.priority, i.status,
             i.description, i.reported_by, i.created_at
      FROM mgm.incidents i
      WHERE i.status = 'open'
        AND i.created_at >= NOW() - INTERVAL '30 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM mgm.incident_updates u WHERE u.incident_id = i.incident_id
        )
      ORDER BY
        CASE i.priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
        i.created_at ASC
    `);

    const rows = result.rows;

    return {
      data: {
        new_incidents: rows,
        count: rows.length,
        p1_count: rows.filter(r => r.priority === "P1").length,
        p2_count: rows.filter(r => r.priority === "P2").length,
      },
      summary: `${rows.length} new incident(s) in the last 30 minutes with no initial response. P1: ${rows.filter(r => r.priority === "P1").length}, P2: ${rows.filter(r => r.priority === "P2").length}.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "post_acknowledgment") {
        const { incident_id, message } = action.payload as { incident_id: string; message: string };
        if (incident_id && message) {
          await pool.query(
            `INSERT INTO mgm.incident_updates (incident_id, user_id, content)
             VALUES ($1, 'helix-agent', $2)`,
            [incident_id, message]
          );
          // Also update status to 'acknowledged'
          await pool.query(
            `UPDATE mgm.incidents SET status = 'acknowledged' WHERE incident_id = $1 AND status = 'open'`,
            [incident_id]
          );
          done.push(`Posted acknowledgment for incident ${incident_id}.`);
        }
      }
    }

    return done;
  }
}

export const incidentFirstResponseAgent = new IncidentFirstResponseAgent();
