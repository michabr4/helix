/**
 * Tests for the Change Impact & Communication Agent's observe()/act() logic.
 *
 * observe() is pure aggregation over two SQL queries (pending high-risk
 * changes, recently implemented high-risk changes) — we mock ../db.js so
 * this runs without a real Postgres instance. act() calls the LLM helper,
 * which we also mock.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { ChangeImpactAgent } from "../agents/changeImpact.js";

function mockQueryResults(pendingRows: unknown[], recentRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: pendingRows })
    .mockResolvedValueOnce({ rows: recentRows });
}

describe("ChangeImpactAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags an unimplemented high-risk change for pre-change communication", async () => {
    mockQueryResults(
      [
        {
          change_id: "c1",
          change_number: "CHG-001",
          property_id: "p1",
          property_name: "MGM Grand",
          change_type: "normal",
          risk_level: "high",
          title: "Core switch firmware upgrade",
          implemented_by: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
      []
    );

    const agent = new ChangeImpactAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const pending = data["pending_high_risk_changes"] as Array<{ change_number: string; comms_stage: string }>;

    expect(pending).toHaveLength(1);
    expect(pending[0].change_number).toBe("CHG-001");
    expect(pending[0].comms_stage).toBe("pre_change");
  });

  it("flags a recently implemented high-risk change for post-change confirmation", async () => {
    mockQueryResults(
      [],
      [
        {
          change_id: "c2",
          change_number: "CHG-002",
          property_id: "p1",
          property_name: "Bellagio",
          change_type: "emergency",
          risk_level: "critical",
          title: "Emergency firewall patch",
          implemented_by: "u1",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-02T00:00:00Z",
        },
      ]
    );

    const agent = new ChangeImpactAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const recent = data["recently_implemented_high_risk_changes"] as Array<{ change_number: string; comms_stage: string }>;

    expect(recent).toHaveLength(1);
    expect(recent[0].change_number).toBe("CHG-002");
    expect(recent[0].comms_stage).toBe("post_change");
  });

  it("act() drafts a communication via the LLM for each draft action", async () => {
    const agent = new ChangeImpactAgent();
    const llmSpy = vi.spyOn(agent as unknown as { llm: (p: string) => Promise<string> }, "llm")
      .mockResolvedValue("Subject: Upcoming Change Notification\n\nDraft body.");

    const done = await agent.act([
      {
        id: "draft_change_communication",
        description: "n/a",
        requiresApproval: false,
        payload: {
          changeNumber: "CHG-001",
          propertyName: "MGM Grand",
          title: "Core switch firmware upgrade",
          riskLevel: "high",
          changeType: "normal",
          stage: "pre_change",
        },
      },
    ]);

    expect(llmSpy).toHaveBeenCalledTimes(1);
    expect(done).toHaveLength(1);
    expect(done[0]).toContain("Draft body.");
  });
});
