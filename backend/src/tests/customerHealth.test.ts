/**
 * Tests for the Customer Health Scoring Agent.
 *
 * observe() aggregates two SQL queries (VoC, SLA) and merges them per
 * customer_id (mocked via ../db.js). act() writes the computed scores back
 * to mgm.customer_health_scores via DELETE+INSERT.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { CustomerHealthAgent } from "../agents/customerHealth.js";

function mockQueryResults(vocRows: unknown[], slaRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: vocRows })
    .mockResolvedValueOnce({ rows: slaRows });
}

describe("CustomerHealthAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blends SLA and VoC into a single score when both are present for a customer", async () => {
    mockQueryResults(
      [{ customer_id: "c1", customer_name: "Acme", avg_sentiment: "8.0", signal_count: "5" }],
      [{ customer_id: "c1", total: "10", breached: "0" }]
    );

    const agent = new CustomerHealthAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const scores = data["computed_scores"] as Array<{ customer_id: string; health_score: number; risk_level: string }>;

    // voc_engagement = 8.0/10*100 = 80; sla_compliance = 100; blended = 90
    expect(scores).toHaveLength(1);
    expect(scores[0].customer_id).toBe("c1");
    expect(scores[0].health_score).toBe(90);
    expect(scores[0].risk_level).toBe("green");
  });

  it("uses only the available component when a customer has just one signal type", async () => {
    mockQueryResults(
      [],
      [{ customer_id: "c2", total: "4", breached: "3" }] // 25% compliance
    );

    const agent = new CustomerHealthAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const scores = data["computed_scores"] as Array<{ customer_id: string; health_score: number; risk_level: string }>;

    expect(scores).toHaveLength(1);
    expect(scores[0].health_score).toBe(25);
    expect(scores[0].risk_level).toBe("red");
  });

  it("skips customers with no SLA or VoC data at all", async () => {
    mockQueryResults([], []);

    const agent = new CustomerHealthAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;

    expect(data["computed_scores"]).toEqual([]);
  });

  it("always reports the incident-linkage data gap", async () => {
    mockQueryResults([], []);

    const agent = new CustomerHealthAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const gaps = data["data_gaps"] as string[];

    expect(gaps.some(g => g.includes("property_id"))).toBe(true);
  });
});

describe("CustomerHealthAgent.act", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes and re-inserts a row per computed score", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockResolvedValue({ rows: [] });

    const agent = new CustomerHealthAgent();
    const done = await agent.act([
      {
        id: "recompute_health_scores",
        description: "Refresh scores",
        requiresApproval: false,
        payload: {
          scores: [
            { customer_id: "c1", customer_name: "Acme", health_score: 90, engagement_score: 80, risk_level: "green" },
          ],
        },
      },
    ]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM mgm.customer_health_scores"),
      ["c1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO mgm.customer_health_scores"),
      ["c1", "Acme", 90, 80, "green"]
    );
    expect(done).toEqual(["Refreshed health scores for 1 customer(s)."]);
  });

  it("does nothing when there are no scores to write", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;

    const agent = new CustomerHealthAgent();
    const done = await agent.act([
      { id: "recompute_health_scores", description: "n/a", requiresApproval: false, payload: { scores: [] } },
    ]);

    expect(query).not.toHaveBeenCalled();
    expect(done).toEqual([]);
  });
});
