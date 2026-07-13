/**
 * Agent 10 — Goal Loop Agent (SDM role)
 *
 * Observes: active (non-completed) goals and their key results
 *           (mgm.goals, mgm.key_results). Computes progress % per goal from
 *           key result start/current/target values, compares that progress
 *           to the fraction of time elapsed toward target_date, and
 *           classifies each goal as on_track, at_risk, or off_track.
 * Reasons:  base LLM reasoning proposes an `update_goal_status` action
 *           (auto — a routine status refresh, same pattern as Agent 8's SLA
 *           breach marking and Agent 11's overdue milestone marking) for
 *           goals whose computed status differs from the stored status, and
 *           a `draft_goal_checkin_nudge` action (auto — drafting is
 *           low-risk; the actual outreach is a separate human action) per
 *           off-track goal.
 * Acts:     updates goal status in the DB, snapshots progress history, and
 *           drafts a check-in nudge for the goal owner via the LLM.
 * Reports:  goal health summary with on-track/at-risk/off-track counts.
 *
 * No external API dependencies — reads/writes only mgm.goals,
 * mgm.key_results, and mgm.goal_progress_history, all introduced in this
 * migration. Uses the LLM only for drafting, same as every other Helix
 * agent.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

// A goal is "at risk" once progress lags time-elapsed by this margin, and
// "off track" once it lags by twice that margin.
const AT_RISK_LAG_PCT = 15;
const OFF_TRACK_LAG_PCT = 30;

interface GoalRow {
  goal_id: string;
  title: string;
  owner: string | null;
  status: string;
  start_date: string;
  target_date: string;
}

interface KeyResultRow {
  goal_id: string;
  start_value: string;
  current_value: string;
  target_value: string;
}

function computeProgressPct(krs: KeyResultRow[]): number {
  if (krs.length === 0) return 0;
  const pcts = krs.map(kr => {
    const start = Number(kr.start_value);
    const target = Number(kr.target_value);
    const current = Number(kr.current_value);
    if (target === start) return current >= target ? 100 : 0;
    const pct = ((current - start) / (target - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  });
  return Math.round((pcts.reduce((sum, v) => sum + v, 0) / pcts.length) * 100) / 100;
}

function computeTimeElapsedPct(startDate: string, targetDate: string): number {
  const start = new Date(startDate).getTime();
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  if (target <= start) return 100;
  const pct = ((now - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function classifyStatus(progressPct: number, timeElapsedPct: number): "on_track" | "at_risk" | "off_track" {
  const lag = timeElapsedPct - progressPct;
  if (lag >= OFF_TRACK_LAG_PCT) return "off_track";
  if (lag >= AT_RISK_LAG_PCT) return "at_risk";
  return "on_track";
}

export class GoalLoopAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-10-goal-loop",
      name: "Goal Loop Agent",
      role: "SDM",
      systemPrompt: `You are the Goal Loop agent for a Cisco service delivery team. Your goal is to
keep OKR-style goals honest by comparing measured progress against time elapsed toward each
goal's target date, flagging goals that are falling behind so an SDM can intervene before a
missed goal becomes a surprise. Be factual — cite goal titles, owners, progress percentages,
and exact day counts.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const goalResult = await pool.query<GoalRow>(
      `SELECT goal_id, title, owner, status, start_date::text AS start_date, target_date::text AS target_date
       FROM mgm.goals
       WHERE status != 'completed'
       ORDER BY target_date ASC`
    );

    const goalIds = goalResult.rows.map(g => g.goal_id);
    const krResult = goalIds.length > 0
      ? await pool.query<KeyResultRow>(
          `SELECT goal_id, start_value::text AS start_value, current_value::text AS current_value,
                  target_value::text AS target_value
           FROM mgm.key_results
           WHERE goal_id = ANY($1::uuid[])`,
          [goalIds]
        )
      : { rows: [] as KeyResultRow[] };

    const krsByGoal = new Map<string, KeyResultRow[]>();
    for (const kr of krResult.rows) {
      const list = krsByGoal.get(kr.goal_id) ?? [];
      list.push(kr);
      krsByGoal.set(kr.goal_id, list);
    }

    const goals = goalResult.rows.map(g => {
      const krs = krsByGoal.get(g.goal_id) ?? [];
      const progressPct = computeProgressPct(krs);
      const timeElapsedPct = computeTimeElapsedPct(g.start_date, g.target_date);
      const computedStatus = classifyStatus(progressPct, timeElapsedPct);
      return {
        goal_id: g.goal_id,
        title: g.title,
        owner: g.owner,
        stored_status: g.status,
        computed_status: computedStatus,
        progress_pct: progressPct,
        time_elapsed_pct: Math.round(timeElapsedPct * 100) / 100,
        target_date: g.target_date,
      };
    });

    const statusChanges = goals.filter(g => g.computed_status !== g.stored_status);
    const offTrack = goals.filter(g => g.computed_status === "off_track");
    const atRisk = goals.filter(g => g.computed_status === "at_risk");
    const onTrack = goals.filter(g => g.computed_status === "on_track");

    return {
      data: {
        goals,
        status_changes: statusChanges,
        off_track_goals: offTrack,
        at_risk_goals: atRisk,
        on_track_goal_count: onTrack.length,
      },
      summary:
        `${goals.length} active goal(s). ${onTrack.length} on track, ${atRisk.length} at risk, ` +
        `${offTrack.length} off track. ${statusChanges.length} goal(s) need a status update.`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "update_goal_status") {
        const updates = (action.payload["updates"] as Array<{ goalId: string; status: string; progressPct: number }> | undefined) ?? [];
        for (const { goalId, status, progressPct } of updates) {
          await pool.query(
            `UPDATE mgm.goals SET status = $1, updated_at = NOW() WHERE goal_id = $2`,
            [status, goalId]
          );
          await pool.query(
            `INSERT INTO mgm.goal_progress_history (goal_id, progress_pct, status) VALUES ($1, $2, $3)`,
            [goalId, progressPct, status]
          );
        }
        if (updates.length > 0) {
          done.push(`Updated status for ${updates.length} goal(s) and recorded progress snapshots.`);
        }
      }

      if (action.id === "draft_goal_checkin_nudge") {
        const { title, owner, progressPct, timeElapsedPct } = action.payload as {
          title?: string;
          owner?: string;
          progressPct?: number;
          timeElapsedPct?: number;
        };

        const draft = await this.llm(`
Draft a short internal check-in nudge to goal owner "${owner ?? "unassigned"}" about goal
"${title ?? "unknown"}", which is off track: ${progressPct ?? 0}% progress vs. ${timeElapsedPct ?? 0}%
of the timeline elapsed.

Format as a brief, direct internal message (not customer-facing) with:
- Why this goal is off track
- A specific ask (updated plan or escalate blocker)

This is a DRAFT pending SDM review before being sent.
`);
        done.push(draft);
      }
    }

    return done;
  }
}

export const goalLoopAgent = new GoalLoopAgent();
