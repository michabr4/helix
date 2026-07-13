/**
 * Tests for the Delivery Performance Benchmarking Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (property MTTR, SLA
 * compliance by customer) — we mock ../db.js so this runs without a real
 * Postgres instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { DeliveryBenchmarkAgent } from "../agents/deliveryBenchmark.js";

function mockQueryResults(mttrRows: unknown[], slaRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: mttrRows })
    .mockResolvedValueOnce({ rows: slaRows });
}

describe("DeliveryBenchmarkAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags a property with MTTR far above the mean as a worst outlier", async () => {
    mockQueryResults(
      [
        { property_id: "p1", property_name: "Slow Hotel", resolved_count: "5", avg_resolution_hours: "100" },
        { property_id: "p2", property_name: "Fast Hotel", resolved_count: "5", avg_resolution_hours: "10" },
        { property_id: "p3", property_name: "Mid Hotel A", resolved_count: "5", avg_resolution_hours: "10" },
        { property_id: "p4", property_name: "Mid Hotel B", resolved_count: "5", avg_resolution_hours: "10" },
      ],
      []
    );

    const agent = new DeliveryBenchmarkAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const worst = data["mttr_worst_outliers"] as Array<{ property_id: string }>;

    expect(worst.map(w => w.property_id)).toContain("p1");
  });

  it("flags a property with MTTR far below the mean as a best practice", async () => {
    mockQueryResults(
      [
        { property_id: "p1", property_name: "Slow Hotel A", resolved_count: "5", avg_resolution_hours: "50" },
        { property_id: "p2", property_name: "Slow Hotel B", resolved_count: "5", avg_resolution_hours: "50" },
        { property_id: "p3", property_name: "Slow Hotel C", resolved_count: "5", avg_resolution_hours: "50" },
        { property_id: "p4", property_name: "Star Hotel", resolved_count: "5", avg_resolution_hours: "1" },
      ],
      []
    );

    const agent = new DeliveryBenchmarkAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const best = data["mttr_best_practices"] as Array<{ property_id: string }>;

    expect(best.map(b => b.property_id)).toContain("p4");
  });

  it("computes SLA compliance percentage per customer", async () => {
    mockQueryResults(
      [],
      [{ customer_id: "cust-1", total: "10", breached: "3" }]
    );

    const agent = new DeliveryBenchmarkAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const sla = data["sla_compliance_by_customer"] as Array<{ customer_id: string; compliance_pct: number }>;

    expect(sla).toEqual([{ customer_id: "cust-1", total_sla_records: 10, breached_count: 3, compliance_pct: 70 }]);
  });

  it("always reports the on-time-sync and CSAT data gaps", async () => {
    mockQueryResults([], []);

    const agent = new DeliveryBenchmarkAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;
    const gaps = data["data_gaps"] as string[];

    expect(gaps.some(g => g.includes("on-time sync"))).toBe(true);
    expect(gaps.some(g => g.includes("CSAT"))).toBe(true);
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new DeliveryBenchmarkAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
