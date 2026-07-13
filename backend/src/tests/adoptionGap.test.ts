/**
 * Tests for the Adoption & Utilization Gap Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (stalled deployments,
 * license utilization) — we mock ../db.js so this runs without a real
 * Postgres instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { AdoptionGapAgent } from "../agents/adoptionGap.js";

function mockQueryResults(stalledRows: unknown[], usageRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: stalledRows })
    .mockResolvedValueOnce({ rows: usageRows });
}

describe("AdoptionGapAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces deployments stalled in an early phase", async () => {
    mockQueryResults(
      [
        {
          adoption_id: "a1",
          property_id: "p1",
          property_name: "MGM Grand",
          technology_name: "Catalyst Center",
          deployment_phase: "pilot",
          devices_deployed: 12,
          updated_at: "2025-01-01T00:00:00Z",
          days_in_phase: "60",
        },
      ],
      []
    );

    const agent = new AdoptionGapAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const stalled = data["stalled_deployments"] as Array<{ property_name: string; days_in_phase: number }>;

    expect(stalled).toHaveLength(1);
    expect(stalled[0].property_name).toBe("MGM Grand");
    expect(stalled[0].days_in_phase).toBe(60);
  });

  it("flags a license under the underutilization threshold", async () => {
    mockQueryResults(
      [],
      [
        {
          usage_id: "u1",
          property_id: "p1",
          property_name: "MGM Grand",
          license_id: "l1",
          product_name: "DNA Center Advantage",
          sku: "DNA-A",
          quantity_used: "10",
          quantity_purchased: "100",
        },
      ]
    );

    const agent = new AdoptionGapAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const underutilized = data["underutilized_licenses"] as Array<{ product_name: string; utilization_pct: number }>;
    const nearCapacity = data["near_capacity_licenses"] as unknown[];

    expect(underutilized).toHaveLength(1);
    expect(underutilized[0].product_name).toBe("DNA Center Advantage");
    expect(underutilized[0].utilization_pct).toBe(0.1);
    expect(nearCapacity).toHaveLength(0);
  });

  it("flags a license at/above the near-capacity threshold", async () => {
    mockQueryResults(
      [],
      [
        {
          usage_id: "u2",
          property_id: "p2",
          property_name: "Bellagio",
          license_id: "l2",
          product_name: "Webex Suite",
          sku: "WBX-S",
          quantity_used: "95",
          quantity_purchased: "100",
        },
      ]
    );

    const agent = new AdoptionGapAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const nearCapacity = data["near_capacity_licenses"] as Array<{ property_name: string }>;
    const underutilized = data["underutilized_licenses"] as unknown[];

    expect(nearCapacity).toHaveLength(1);
    expect(nearCapacity[0].property_name).toBe("Bellagio");
    expect(underutilized).toHaveLength(0);
  });

  it("does not flag licenses within the healthy utilization band", async () => {
    mockQueryResults(
      [],
      [
        {
          usage_id: "u3",
          property_id: "p3",
          property_name: "Aria",
          license_id: "l3",
          product_name: "Meraki Advanced",
          sku: "MER-A",
          quantity_used: "60",
          quantity_purchased: "100",
        },
      ]
    );

    const agent = new AdoptionGapAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["underutilized_licenses"]).toHaveLength(0);
    expect(data["near_capacity_licenses"]).toHaveLength(0);
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new AdoptionGapAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
