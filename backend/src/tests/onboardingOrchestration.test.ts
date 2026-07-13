/**
 * Tests for the Customer Onboarding Orchestration Agent's observe()/act()
 * logic.
 *
 * observe() is pure aggregation over a single SQL query (onboarding-stage
 * journey milestones) — we mock ../db.js so this runs without a real
 * Postgres instance. act() covers both the auto DB write (mark_overdue)
 * and the LLM draft (draft_onboarding_nudge).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { OnboardingOrchestrationAgent } from "../agents/onboardingOrchestration.js";

function mockQueryResults(rows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query.mockResolvedValueOnce({ rows });
}

describe("OnboardingOrchestrationAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags an overdue milestone", async () => {
    mockQueryResults([
      {
        milestone_id: "m1",
        customer_id: "cust-1",
        customer_name: "Acme Corp",
        phase: "kickoff",
        name: "Kickoff call",
        status: "pending",
        target_date: "2025-01-01",
        owner: "csm-1",
        days_to_target: "-5",
      },
    ]);

    const agent = new OnboardingOrchestrationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const overdue = data["overdue_milestones"] as Array<{ milestone_id: string }>;

    expect(overdue).toHaveLength(1);
    expect(overdue[0].milestone_id).toBe("m1");
  });

  it("flags a milestone due within the due-soon window", async () => {
    mockQueryResults([
      {
        milestone_id: "m2",
        customer_id: "cust-2",
        customer_name: "Beta LLC",
        phase: "provisioning",
        name: "Device shipment",
        status: "in-progress",
        target_date: "2025-01-05",
        owner: "csm-2",
        days_to_target: "3",
      },
    ]);

    const agent = new OnboardingOrchestrationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const dueSoon = data["due_soon_milestones"] as Array<{ milestone_id: string }>;

    expect(dueSoon).toHaveLength(1);
    expect(dueSoon[0].milestone_id).toBe("m2");
  });

  it("flags a stalled customer (all milestones pending, at least one overdue)", async () => {
    mockQueryResults([
      {
        milestone_id: "m3",
        customer_id: "cust-3",
        customer_name: "Gamma Inc",
        phase: "kickoff",
        name: "Kickoff call",
        status: "pending",
        target_date: "2025-01-01",
        owner: "csm-3",
        days_to_target: "-10",
      },
      {
        milestone_id: "m4",
        customer_id: "cust-3",
        customer_name: "Gamma Inc",
        phase: "provisioning",
        name: "Device shipment",
        status: "pending",
        target_date: "2025-02-01",
        owner: "csm-3",
        days_to_target: "20",
      },
    ]);

    const agent = new OnboardingOrchestrationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const stalled = data["stalled_customers"] as Array<{ customer_id: string }>;

    expect(stalled).toHaveLength(1);
    expect(stalled[0].customer_id).toBe("cust-3");
  });

  it("act() marks milestones overdue in the DB", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockReset();
    query.mockResolvedValue({ rows: [] });

    const agent = new OnboardingOrchestrationAgent();
    const done = await agent.act([
      { id: "mark_overdue", description: "n/a", requiresApproval: false, payload: { milestone_ids: ["m1", "m2"] } },
    ]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE mgm.journey_milestones"),
      [["m1", "m2"]]
    );
    expect(done).toHaveLength(1);
  });

  it("act() drafts an onboarding nudge via the LLM", async () => {
    const agent = new OnboardingOrchestrationAgent();
    const llmSpy = vi.spyOn(agent as unknown as { llm: (p: string) => Promise<string> }, "llm")
      .mockResolvedValue("Nudge: please update status.");

    const done = await agent.act([
      {
        id: "draft_onboarding_nudge",
        description: "n/a",
        requiresApproval: false,
        payload: { customerName: "Gamma Inc", owner: "csm-3", nextMilestone: "Kickoff call" },
      },
    ]);

    expect(llmSpy).toHaveBeenCalledTimes(1);
    expect(done).toHaveLength(1);
    expect(done[0]).toContain("Nudge");
  });
});
