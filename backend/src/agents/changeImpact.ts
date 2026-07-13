/**
 * Agent 15 — Change Impact & Communication Agent (SDM role)
 *
 * Observes: high-risk/emergency changes (mgm.changes) that have not yet been
 *           implemented (implemented_by IS NULL) — these are candidates for
 *           a pre-change customer notification — and high-risk changes
 *           implemented in the last 48 hours, which are candidates for a
 *           post-change confirmation communication.
 * Reasons:  base LLM reasoning proposes a `draft_change_communication`
 *           action per flagged change (auto — drafting itself is low-risk;
 *           the eventual send is a separate human action, same pattern as
 *           Agent 12's Executive Communications Drafting agent).
 * Acts:     drafts the actual pre-change or post-change communication text
 *           via the LLM. There is no dedicated "communications" table in
 *           this schema (same gap noted by Agent 12), so the draft is
 *           returned in the job's `actions_taken` / final report rather
 *           than invented storage.
 * Reports:  summary of drafted communications with change numbers and risk
 *           levels.
 *
 * Data-availability note: mgm.changes has no scheduled/implementation
 * window field and no "communication sent" tracking, so this agent cannot
 * know whether a customer was already notified about a given change. It
 * flags every unimplemented high-risk/emergency change as a communication
 * candidate rather than guessing at a schedule; this gap is reported
 * explicitly in the agent's output.
 *
 * No external API dependencies — reads only from mgm.changes and
 * mgm.properties, both already present in this database. Uses the LLM only
 * for drafting, same as every other Helix agent.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const POST_CHANGE_WINDOW_HOURS = 48;
const HIGH_RISK_LEVELS = ["high", "critical"];

interface ChangeRow {
  change_id: string;
  change_number: string | null;
  property_id: string;
  property_name: string;
  change_type: string | null;
  risk_level: string | null;
  title: string;
  implemented_by: string | null;
  created_at: string;
  updated_at: string;
}

export class ChangeImpactAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-15-change-impact-communication",
      name: "Change Impact & Communication Agent",
      role: "SDM",
      systemPrompt: `You are the Change Impact & Communication agent for a Cisco service
delivery team. Your goal is to make sure high-risk and emergency changes are proactively
communicated to affected customers — before implementation when possible, and with a
confirmation afterward. Drafts must be grounded strictly in the change facts provided,
never invent a schedule or outcome that isn't in the data, and must always be flagged as
a draft pending human review before it is sent to anyone.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [pendingResult, recentResult] = await Promise.all([
      pool.query<ChangeRow>(
        `SELECT
           c.change_id, c.change_number, c.property_id, p.name AS property_name,
           c.change_type, c.risk_level, c.title, c.implemented_by,
           c.created_at, c.updated_at
         FROM mgm.changes c
         JOIN mgm.properties p ON p.property_id = c.property_id
         WHERE c.implemented_by IS NULL
           AND (c.risk_level = ANY($1) OR c.change_type = 'emergency')
         ORDER BY c.created_at ASC`,
        [HIGH_RISK_LEVELS]
      ),
      pool.query<ChangeRow>(
        `SELECT
           c.change_id, c.change_number, c.property_id, p.name AS property_name,
           c.change_type, c.risk_level, c.title, c.implemented_by,
           c.created_at, c.updated_at
         FROM mgm.changes c
         JOIN mgm.properties p ON p.property_id = c.property_id
         WHERE c.implemented_by IS NOT NULL
           AND c.risk_level = ANY($1)
           AND c.updated_at >= NOW() - INTERVAL '${POST_CHANGE_WINDOW_HOURS} hours'
         ORDER BY c.updated_at DESC`,
        [HIGH_RISK_LEVELS]
      ),
    ]);

    const pendingChanges = pendingResult.rows.map(r => ({ ...r, comms_stage: "pre_change" as const }));
    const recentChanges = recentResult.rows.map(r => ({ ...r, comms_stage: "post_change" as const }));

    return {
      data: {
        post_change_window_hours: POST_CHANGE_WINDOW_HOURS,
        pending_high_risk_changes: pendingChanges,
        recently_implemented_high_risk_changes: recentChanges,
        data_gaps: [
          "mgm.changes has no scheduled/implementation-window field and no communication-sent " +
            "tracking, so this agent cannot know whether a customer was already notified about a " +
            "given change — every unimplemented high-risk/emergency change is flagged as a " +
            "communication candidate.",
        ],
      },
      summary:
        `${pendingChanges.length} unimplemented high-risk/emergency change(s) need pre-change ` +
        `communication. ${recentChanges.length} high-risk change(s) implemented in the last ` +
        `${POST_CHANGE_WINDOW_HOURS}h need post-change confirmation.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "draft_change_communication") {
        const { changeNumber, propertyName, title, riskLevel, changeType, stage } = action.payload as {
          changeNumber?: string;
          propertyName?: string;
          title?: string;
          riskLevel?: string;
          changeType?: string;
          stage?: "pre_change" | "post_change";
        };

        const draft = await this.llm(`
Draft a ${stage === "post_change" ? "post-change confirmation" : "pre-change notification"}
communication to the customer at property "${propertyName ?? "unknown property"}".

Change: ${changeNumber ?? "unknown"} — ${title ?? "no title"}
Risk level: ${riskLevel ?? "unknown"}
Change type: ${changeType ?? "unknown"}

Format as a short, professional message with:
- A clear subject line
- 2-3 concise paragraphs explaining the change and its impact
- A closing line inviting follow-up questions

This is a DRAFT pending human review — do not claim it has been sent.
`);
        done.push(draft);
      }
    }

    return done;
  }
}

export const changeImpactAgent = new ChangeImpactAgent();
