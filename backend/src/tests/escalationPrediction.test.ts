/**
 * Tests for the Escalation Prediction Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (historical average
 * resolution time per priority, open incidents with staleness/child counts)
 * — we mock ../db.js so this runs without a real Postgres instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { EscalationPredictionAgent } from "../agents/escalationPrediction.js";

function mockQueryResults(avgRows: unknown[], openRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: avgRows })
    .mockResolvedValueOnce({ rows: openRows });
}

describe("EscalationPredictionAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags an incident aging beyond the historical average for its priority", async () => {
    mockQueryResults(
      [{ priority: "P2", avg_hours: "10", sample_count: "5" }],
      [
        {
          incident_id: "i1",
          incident_number: "INC-001",
          title: "Aging incident",
          priority: "P2",
          status: "investigating",
          property_id: "p1",
          created_at: "2025-01-01T00:00:00Z",
          open_hours: "20",
          last_update_at: new Date().toISOString(),
          child_count: "0",
        },
      ]
    );

    const agent = new EscalationPredictionAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const aging = data["aging_incidents"] as Array<{ incident_id: string }>;

    expect(aging).toHaveLength(1);
    expect(aging[0].incident_id).toBe("i1");
  });

  it("does not flag aging when there is insufficient historical sample size", async () => {
    mockQueryResults(
      [{ priority: "P2", avg_hours: "10", sample_count: "1" }],
      [
        {
          incident_id: "i2",
          incident_number: "INC-002",
          title: "Not enough history",
          priority: "P2",
          status: "open",
          property_id: "p1",
          created_at: "2025-01-01T00:00:00Z",
          open_hours: "20",
          last_update_at: new Date().toISOString(),
          child_count: "0",
        },
      ]
    );

    const agent = new EscalationPredictionAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["aging_incidents"]).toHaveLength(0);
    expect((data["data_gaps"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("flags a stale incident with no recent update activity", async () => {
    mockQueryResults(
      [],
      [
        {
          incident_id: "i3",
          incident_number: "INC-003",
          title: "Stale incident",
          priority: "P3",
          status: "open",
          property_id: "p1",
          created_at: "2025-01-01T00:00:00Z",
          open_hours: "48",
          last_update_at: null,
          child_count: "0",
        },
      ]
    );

    const agent = new EscalationPredictionAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const stale = data["stale_incidents"] as Array<{ incident_id: string }>;

    expect(stale).toHaveLength(1);
    expect(stale[0].incident_id).toBe("i3");
  });

  it("flags an incident with widening impact via child incident count", async () => {
    mockQueryResults(
      [],
      [
        {
          incident_id: "i4",
          incident_number: "INC-004",
          title: "Widening incident",
          priority: "P1",
          status: "investigating",
          property_id: "p1",
          created_at: "2025-01-01T00:00:00Z",
          open_hours: "5",
          last_update_at: new Date().toISOString(),
          child_count: "3",
        },
      ]
    );

    const agent = new EscalationPredictionAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const widening = data["widening_incidents"] as Array<{ incident_id: string }>;

    expect(widening).toHaveLength(1);
    expect(widening[0].incident_id).toBe("i4");
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new EscalationPredictionAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
