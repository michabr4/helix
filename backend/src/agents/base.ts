/**
 * Helix Base Agent
 *
 * All role-based agents extend this class and implement the four steps of
 * the Observe → Reason → Act → Report cycle described in the Helix Agentic
 * Framework v2 design document.
 *
 * Human-in-the-loop: any agent that wants to perform a write action calls
 * `requestApproval()` which persists an approval record in the DB and blocks
 * execution until approved (or it can be set to auto-approve for low-risk
 * actions via `requiresApproval = false` on an action).
 */
import { pool } from "../db.js";
import { llm, llmJson } from "./llm.js";

export type AgentRole = "SDM" | "PM" | "PgM" | "CSM" | "HTOM";

export interface ObserveResult {
  data: Record<string, unknown>;
  summary: string;
}

export interface ReasonResult {
  analysis: string;
  recommendedActions: ActionSpec[];
  confidence: number; // 0–1
}

export interface ActionSpec {
  id: string;
  description: string;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
}

export interface ReportResult {
  title: string;
  summary: string;
  actions_taken: string[];
  next_steps: string[];
  generated_at: string;
}

/**
 * Abstract base for all Helix agents.
 * Subclasses must implement `observe()` and `act()`.
 * `reason()` and `report()` have default LLM-powered implementations that
 * subclasses can override.
 */
export abstract class HelixAgent {
  readonly agentId: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly systemPrompt: string;

  constructor(params: { agentId: string; name: string; role: AgentRole; systemPrompt: string }) {
    this.agentId = params.agentId;
    this.name = params.name;
    this.role = params.role;
    this.systemPrompt = params.systemPrompt;
  }

  /** STEP 1 — Gather data from DB/APIs needed for this agent's domain */
  abstract observe(input: Record<string, unknown>): Promise<ObserveResult>;

  /** STEP 3 — Execute approved actions, return descriptions of what was done */
  abstract act(actions: ActionSpec[]): Promise<string[]>;

  /** STEP 2 — Use LLM to reason about observations and produce action recommendations */
  async reason(observation: ObserveResult): Promise<ReasonResult> {
    const prompt = `You are the ${this.name} agent (role: ${this.role}).

## Observation
${observation.summary}

## Raw Data
${JSON.stringify(observation.data, null, 2)}

Analyze the above data and recommend specific, concrete actions. For each action specify:
- id: a short snake_case identifier
- description: what will be done and why
- requiresApproval: true if this modifies data or sends notifications; false for read-only analysis
- payload: structured data the action executor will need

Respond with JSON matching:
{
  "analysis": "string summarizing key findings",
  "recommendedActions": [{ "id": "string", "description": "string", "requiresApproval": boolean, "payload": {} }],
  "confidence": 0.0
}`;

    return llmJson<ReasonResult>(prompt, this.systemPrompt);
  }

  /** STEP 4 — Summarise what happened into a structured report */
  async report(
    observation: ObserveResult,
    reasoning: ReasonResult,
    actionsTaken: string[]
  ): Promise<ReportResult> {
    const prompt = `You are the ${this.name} agent. Summarise the completed cycle.

## Analysis
${reasoning.analysis}

## Actions Taken
${actionsTaken.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Generate a concise report as JSON:
{
  "title": "short report title",
  "summary": "2-3 sentence executive summary",
  "actions_taken": ["list of completed actions"],
  "next_steps": ["list of follow-up items for human review"],
  "generated_at": "ISO timestamp"
}`;

    const result = await llmJson<ReportResult>(prompt, this.systemPrompt);
    result.generated_at = new Date().toISOString();
    return result;
  }

  /**
   * Main entry point — runs the full Observe→Reason→Act→Report cycle.
   * Persists job record to mgm.agent_jobs throughout.
   */
  async run(input: Record<string, unknown> = {}): Promise<ReportResult> {
    // Persist job start
    const jobRes = await pool.query(
      `INSERT INTO mgm.agent_jobs (agent_id, agent_name, role, status, input, started_at)
       VALUES ($1, $2, $3, 'running', $4, NOW())
       RETURNING job_id`,
      [this.agentId, this.name, this.role, JSON.stringify(input)]
    );
    const jobId: string = jobRes.rows[0].job_id;

    try {
      // Step 1: Observe
      const observation = await this.observe(input);

      // Step 2: Reason
      const reasoning = await this.reason(observation);

      // Step 3: Act — only execute actions that don't require approval
      //         (approval-required actions are queued via requestApproval)
      const autoActions = reasoning.recommendedActions.filter(a => !a.requiresApproval);
      const approvalActions = reasoning.recommendedActions.filter(a => a.requiresApproval);

      // Create approval requests for guarded actions
      await Promise.all(
        approvalActions.map(a =>
          this.requestApproval(jobId, a)
        )
      );

      const actionsTaken = await this.act(autoActions);

      // Step 4: Report
      const report = await this.report(observation, reasoning, actionsTaken);

      // Mark job complete
      await pool.query(
        `UPDATE mgm.agent_jobs
         SET status = 'completed', output = $1, finished_at = NOW()
         WHERE job_id = $2`,
        [JSON.stringify(report), jobId]
      );

      return report;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE mgm.agent_jobs
         SET status = 'error', error = $1, finished_at = NOW()
         WHERE job_id = $2`,
        [errorMessage, jobId]
      );
      throw err;
    }
  }

  /** Create a human-approval request for an action that requires review */
  protected async requestApproval(jobId: string, action: ActionSpec): Promise<void> {
    await pool.query(
      `INSERT INTO mgm.agent_approvals
       (job_id, agent_id, agent_name, action, context, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [
        jobId,
        this.agentId,
        this.name,
        action.description,
        JSON.stringify(action.payload),
      ]
    );
  }

  /** Helper for subclasses to call LLM directly */
  protected async llm(prompt: string): Promise<string> {
    return llm(prompt, this.systemPrompt);
  }

  protected async llmJson<T>(prompt: string): Promise<T> {
    return llmJson<T>(prompt, this.systemPrompt);
  }
}
