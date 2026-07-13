/**
 * Tests for the Goal Loop Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (active goals, their
 * key results) — we mock ../db.js so this runs without a real Postgres
 * instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { GoalLoopAgent } from "../agents/goalLoop.js";

function mockQueryResults(goalRows: unknown[], keyResultRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: goalRows })
    .mockResolvedValueOnce({ rows: keyResultRows });
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("GoalLoopAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies a goal as on_track when progress matches time elapsed", async () => {
    mockQueryResults(
      [
        {
          goal_id: "g1",
          title: "Reduce P1 MTTR",
          owner: "alice",
          status: "on_track",
          start_date: isoDaysFromNow(-50),
          target_date: isoDaysFromNow(50),
        },
      ],
      [
        { goal_id: "g1", start_value: "0", current_value: "50", target_value: "100" },
      ]
    );

    const agent = new GoalLoopAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const goals = data["goals"] as Array<{ goal_id: string; computed_status: string }>;

    expect(goals).toHaveLength(1);
    expect(goals[0].computed_status).toBe("on_track");
  });

  it("classifies a goal as off_track when progress heavily lags time elapsed", async () => {
    mockQueryResults(
      [
        {
          goal_id: "g2",
          title: "Improve CSAT",
          owner: "bob",
          status: "on_track",
          start_date: isoDaysFromNow(-90),
          target_date: isoDaysFromNow(10),
        },
      ],
      [
        { goal_id: "g2", start_value: "0", current_value: "10", target_value: "100" },
      ]
    );

    const agent = new GoalLoopAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const offTrack = data["off_track_goals"] as Array<{ goal_id: string }>;
    const statusChanges = data["status_changes"] as Array<{ goal_id: string }>;

    expect(offTrack).toHaveLength(1);
    expect(offTrack[0].goal_id).toBe("g2");
    expect(statusChanges).toHaveLength(1);
  });

  it("handles goals with no key results as zero progress", async () => {
    mockQueryResults(
      [
        {
          goal_id: "g3",
          title: "New goal, no KRs yet",
          owner: null,
          status: "on_track",
          start_date: isoDaysFromNow(-1),
          target_date: isoDaysFromNow(1),
        },
      ],
      []
    );

    const agent = new GoalLoopAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const goals = data["goals"] as Array<{ progress_pct: number }>;

    expect(goals[0].progress_pct).toBe(0);
  });

  it("act() updates goal status and drafts a nudge via the LLM", async () => {
    const agent = new GoalLoopAgent();
    const llmSpy = vi.spyOn(agent as unknown as { llm: (p: string) => Promise<string> }, "llm")
      .mockResolvedValue("Draft nudge text");

    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockReset();
    query.mockResolvedValue({ rows: [] });

    const results = await agent.act([
      {
        id: "update_goal_status",
        payload: { updates: [{ goalId: "g2", status: "off_track", progressPct: 10 }] },
      } as never,
      {
        id: "draft_goal_checkin_nudge",
        payload: { title: "Improve CSAT", owner: "bob", progressPct: 10, timeElapsedPct: 90 },
      } as never,
    ]);

    expect(query).toHaveBeenCalledTimes(2);
    expect(llmSpy).toHaveBeenCalled();
    expect(results).toContain("Draft nudge text");
    expect(results.some(r => r.includes("Updated status for 1 goal"))).toBe(true);
  });
});
