/**
 * Tests for the Resource Utilization Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (engineer load, RAID
 * ownership) — we mock ../db.js so this runs without a real Postgres instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { ResourceUtilizationAgent } from "../agents/resourceUtilization.js";

function mockQueryResults(engineerRows: unknown[], raidRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: engineerRows })
    .mockResolvedValueOnce({ rows: raidRows });
}

describe("ResourceUtilizationAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags an engineer whose open load is dominated by P1/P2 incidents", async () => {
    mockQueryResults(
      [
        { user_id: "u1", full_name: "Alice Engineer", total_open: "5", high_severity_open: "5" },
        { user_id: "u2", full_name: "Bob Engineer", total_open: "4", high_severity_open: "1" },
      ],
      []
    );

    const agent = new ResourceUtilizationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const overloaded = data["overloaded_engineers"] as Array<{ user_id: string }>;

    expect(overloaded).toHaveLength(1);
    expect(overloaded[0].user_id).toBe("u1");
  });

  it("does not flag an engineer below the minimum load threshold even at 100% severity", async () => {
    mockQueryResults(
      [{ user_id: "u3", full_name: "Cara Engineer", total_open: "2", high_severity_open: "2" }],
      []
    );

    const agent = new ResourceUtilizationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const overloaded = data["overloaded_engineers"] as unknown[];

    expect(overloaded).toHaveLength(0);
  });

  it("detects a demand peak relative to team average load", async () => {
    mockQueryResults(
      [
        { user_id: "u1", full_name: "Alice Engineer", total_open: "10", high_severity_open: "2" },
        { user_id: "u2", full_name: "Bob Engineer", total_open: "2", high_severity_open: "0" },
        { user_id: "u3", full_name: "Cara Engineer", total_open: "2", high_severity_open: "0" },
      ],
      []
    );

    const agent = new ResourceUtilizationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const peaks = data["demand_peaks"] as Array<{ user_id: string }>;

    expect(peaks.map(p => p.user_id)).toContain("u1");
  });

  it("aggregates open RAID item counts by owner", async () => {
    mockQueryResults(
      [],
      [
        { owner: "Dana PM", open_items: "3" },
        { owner: "Eli PM", open_items: "1" },
      ]
    );

    const agent = new ResourceUtilizationAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const raid = data["raid_ownership"] as Array<{ owner: string; open_items: number }>;

    expect(raid).toEqual([
      { owner: "Dana PM", open_items: 3 },
      { owner: "Eli PM", open_items: 1 },
    ]);
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new ResourceUtilizationAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
