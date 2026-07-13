/**
 * Agent 11 — Customer Onboarding Orchestration Agent (CSM role)
 *
 * Observes: onboarding-stage journey milestones (mgm.journey_milestones
 *           WHERE lifecycle_stage = 'onboarding') that are not yet
 *           completed — grouping by customer to find overdue milestones,
 *           milestones due soon, and customers whose onboarding has
 *           stalled (no milestone completed while others are overdue).
 * Reasons:  base LLM reasoning proposes a `mark_overdue` action (auto — a
 *           routine status refresh, same pattern as Agent 8's SLA breach
 *           marking) for milestones past their target_date, and a
 *           `draft_onboarding_nudge` action (auto — drafting is low-risk;
 *           the actual outreach is a separate human action) per stalled
 *           customer.
 * Acts:     marks overdue milestones' status in the DB, and drafts a nudge
 *           communication for the milestone owner via the LLM.
 * Reports:  onboarding health summary with overdue/due-soon counts and
 *           stalled-customer list.
 *
 * No external API dependencies — reads/writes only mgm.journey_milestones,
 * already present in this database. Uses the LLM only for drafting, same
 * as every other Helix agent.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const DUE_SOON_WINDOW_DAYS = 7;
const ONBOARDING_STAGE = "onboarding";

interface MilestoneRow {
  milestone_id: string;
  customer_id: string;
  customer_name: string;
  phase: string;
  name: string;
  status: string;
  target_date: string;
  owner: string | null;
  days_to_target: string;
}

export class OnboardingOrchestrationAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-11-customer-onboarding-orchestration",
      name: "Customer Onboarding Orchestration Agent",
      role: "CSM",
      systemPrompt: `You are the Customer Onboarding Orchestration agent for a Cisco service
delivery team. Your goal is to keep new-customer onboarding on track by surfacing overdue
milestones, upcoming milestones, and customers whose onboarding has stalled, so a CSM can
intervene before a slow start becomes a churn risk. Be factual — cite customer names,
milestone names, owners, and exact day counts.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const result = await pool.query<MilestoneRow>(
      `SELECT
         milestone_id, customer_id, customer_name, phase, name, status,
         target_date::text AS target_date, owner,
         (target_date - CURRENT_DATE)::text AS days_to_target
       FROM mgm.journey_milestones
       WHERE lifecycle_stage = $1 AND status != 'completed'
       ORDER BY target_date ASC`,
      [ONBOARDING_STAGE]
    );

    const milestones = result.rows.map(r => ({
      milestone_id: r.milestone_id,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      phase: r.phase,
      name: r.name,
      status: r.status,
      target_date: r.target_date,
      owner: r.owner,
      days_to_target: Number(r.days_to_target),
    }));

    const overdue = milestones.filter(m => m.days_to_target < 0 && m.status !== "overdue");
    const dueSoon = milestones.filter(m => m.days_to_target >= 0 && m.days_to_target <= DUE_SOON_WINDOW_DAYS);

    const byCustomer = new Map<string, typeof milestones>();
    for (const m of milestones) {
      const list = byCustomer.get(m.customer_id) ?? [];
      list.push(m);
      byCustomer.set(m.customer_id, list);
    }

    const stalledCustomers = Array.from(byCustomer.entries())
      .filter(([, list]) => list.every(m => m.status === "pending") && list.some(m => m.days_to_target < 0))
      .map(([customerId, list]) => ({
        customer_id: customerId,
        customer_name: list[0].customer_name,
        overdue_milestone_count: list.filter(m => m.days_to_target < 0).length,
        next_milestone: list[0].name,
        owner: list[0].owner,
      }));

    return {
      data: {
        due_soon_window_days: DUE_SOON_WINDOW_DAYS,
        overdue_milestones: overdue,
        due_soon_milestones: dueSoon,
        stalled_customers: stalledCustomers,
        active_onboarding_customer_count: byCustomer.size,
      },
      summary:
        `${byCustomer.size} customer(s) actively onboarding. ${overdue.length} milestone(s) overdue, ` +
        `${dueSoon.length} due within ${DUE_SOON_WINDOW_DAYS} days, ${stalledCustomers.length} customer(s) ` +
        `with stalled onboarding (no progress and at least one overdue milestone).`,
    };
  }

  async act(actions: ActionSpec[]): Promise<string[]> {
    const done: string[] = [];

    for (const action of actions) {
      if (action.id === "mark_overdue") {
        const ids = (action.payload["milestone_ids"] as string[] | undefined) ?? [];
        if (ids.length > 0) {
          await pool.query(
            `UPDATE mgm.journey_milestones SET status = 'overdue' WHERE milestone_id = ANY($1::uuid[]) AND status != 'completed'`,
            [ids]
          );
          done.push(`Marked ${ids.length} onboarding milestone(s) as overdue.`);
        }
      }

      if (action.id === "draft_onboarding_nudge") {
        const { customerName, owner, nextMilestone } = action.payload as {
          customerName?: string;
          owner?: string;
          nextMilestone?: string;
        };

        const draft = await this.llm(`
Draft a short internal nudge message to onboarding owner "${owner ?? "unassigned"}" about
customer "${customerName ?? "unknown"}" whose onboarding has stalled. Their next milestone is
"${nextMilestone ?? "unknown"}".

Format as a brief, direct internal message (not customer-facing) with:
- What's stalled and why it matters
- A specific ask (update status or escalate blocker)

This is a DRAFT pending CSM review before being sent.
`);
        done.push(draft);
      }
    }

    return done;
  }
}

export const onboardingOrchestrationAgent = new OnboardingOrchestrationAgent();
