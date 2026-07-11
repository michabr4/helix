/**
 * Agent 10 — Post-Incident Doc Generator (SDM role)
 *
 * Observes: resolved incidents with no post-incident doc.
 * Reasons:  drafts a structured post-incident report for each.
 * Acts:     auto-inserts draft PID into mgm.post_incident_docs.
 *           Requires approval to mark as 'final' or distribute.
 * Reports:  list of drafted PIDs with key findings.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

interface IncidentForPid {
  incident_id: string;
  incident_number: string;
  title: string;
  priority: string;
  description: string;
  created_at: string;
  resolved_at: string;
  updates: Array<{ content: string; created_at: string }>;
}

export class PostIncidentDocAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-10-post-incident-doc",
      name: "Post-Incident Doc Generator",
      role: "SDM",
      systemPrompt: `You are the Post-Incident Documentation agent for a Cisco service delivery team.
Your role is to automatically draft post-incident reports for resolved incidents.
A good PID includes: timeline of events, probable root cause, impact assessment,
remediation steps taken, and action items to prevent recurrence.
Be thorough, factual, and use structured formatting.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    // Find recently resolved incidents that have no PID yet
    const result = await pool.query<IncidentForPid>(`
      SELECT
        i.incident_id,
        i.incident_number,
        i.title,
        i.priority,
        i.description,
        i.created_at,
        i.updated_at AS resolved_at,
        COALESCE(
          json_agg(
            json_build_object('content', u.content, 'created_at', u.created_at)
            ORDER BY u.created_at
          ) FILTER (WHERE u.update_id IS NOT NULL),
          '[]'
        ) AS updates
      FROM mgm.incidents i
      LEFT JOIN mgm.incident_updates u ON u.incident_id = i.incident_id
      WHERE i.status IN ('resolved', 'closed')
        AND i.updated_at >= NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM mgm.post_incident_docs p WHERE p.incident_id = i.incident_id::text
        )
      GROUP BY i.incident_id
      ORDER BY i.priority, i.updated_at DESC
      LIMIT 10
    `);

    const rows = result.rows;

    return {
      data: { incidents: rows, count: rows.length },
      summary: `${rows.length} recently resolved incident(s) need post-incident documentation.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "draft_pid") {
        const { incident_id, title, content, timeline, root_cause, action_items } =
          action.payload as {
            incident_id: string;
            title: string;
            content: string;
            timeline: unknown[];
            root_cause: string;
            action_items: unknown[];
          };

        // Draft the PID content using LLM
        const draftContent = await this.llm(`
Draft a post-incident report for the following incident:

${content}

Format as professional markdown with sections:
## Summary
## Timeline
## Root Cause Analysis
## Impact
## Remediation
## Action Items
`);

        await pool.query(
          `INSERT INTO mgm.post_incident_docs
           (incident_id, title, content, timeline, root_cause, action_items, generated_by, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'agent', 'draft')`,
          [
            incident_id,
            title,
            draftContent,
            JSON.stringify(timeline ?? []),
            root_cause ?? "",
            JSON.stringify(action_items ?? []),
          ]
        );
        done.push(`Drafted post-incident document for incident ${incident_id}.`);
      }
    }

    return done;
  }
}

export const postIncidentDocAgent = new PostIncidentDocAgent();
