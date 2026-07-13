/**
 * Tests for the Renewal Risk Early Warning Agent's observe() logic.
 *
 * observe() is pure aggregation over two SQL queries (expiring device
 * contracts, expiring licenses) — we mock ../db.js so this runs without a
 * real Postgres instance.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { RenewalRiskAgent } from "../agents/renewalRisk.js";

function mockQueryResults(deviceRows: unknown[], licenseRows: unknown[]) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: deviceRows })
    .mockResolvedValueOnce({ rows: licenseRows });
}

describe("RenewalRiskAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies an already-expired device contract as expired", async () => {
    mockQueryResults(
      [
        {
          device_id: "d1",
          hostname: "sw-core-01",
          property_id: "p1",
          property_name: "MGM Grand",
          status: "active",
          contract_number: "C-100",
          contract_expiry: "2025-01-01",
          days_to_expiry: "-5",
        },
      ],
      []
    );

    const agent = new RenewalRiskAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["expired_device_count"]).toBe(1);
    expect(data["critical_device_count"]).toBe(0);
  });

  it("classifies a device contract expiring within the critical window", async () => {
    mockQueryResults(
      [
        {
          device_id: "d2",
          hostname: "sw-core-02",
          property_id: "p1",
          property_name: "MGM Grand",
          status: "active",
          contract_number: "C-101",
          contract_expiry: "2025-01-20",
          days_to_expiry: "15",
        },
      ],
      []
    );

    const agent = new RenewalRiskAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["critical_device_count"]).toBe(1);
    expect(data["warning_device_count"]).toBe(0);
  });

  it("classifies a device contract expiring within the warning window only", async () => {
    mockQueryResults(
      [
        {
          device_id: "d3",
          hostname: "sw-core-03",
          property_id: "p1",
          property_name: "MGM Grand",
          status: "active",
          contract_number: "C-102",
          contract_expiry: "2025-03-01",
          days_to_expiry: "60",
        },
      ],
      []
    );

    const agent = new RenewalRiskAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["warning_device_count"]).toBe(1);
    expect(data["critical_device_count"]).toBe(0);
  });

  it("computes license utilization percentage alongside expiry classification", async () => {
    mockQueryResults(
      [],
      [
        {
          license_id: "l1",
          product_name: "DNA Center Advantage",
          sku: "DNA-A",
          expiry_date: "2025-01-10",
          quantity_purchased: 100,
          quantity_consumed: 80,
          days_to_expiry: "10",
        },
      ]
    );

    const agent = new RenewalRiskAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const licenses = data["expiring_licenses"] as Array<{ license_id: string; utilization_pct: number; risk_tier: string }>;

    expect(licenses).toHaveLength(1);
    expect(licenses[0].utilization_pct).toBe(0.8);
    expect(licenses[0].risk_tier).toBe("critical");
    expect(data["critical_license_count"]).toBe(1);
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new RenewalRiskAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
