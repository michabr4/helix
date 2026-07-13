/**
 * Tests for runCiscoIqSync (Wave 9 adoption sync).
 *
 * Mocks ../db.js and ../integrations/ciscoIqClient.js so this runs without a
 * real Postgres instance or real Cisco IQ credentials.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

const { getInsightsMock } = vi.hoisted(() => ({ getInsightsMock: vi.fn() }));
vi.mock("../integrations/ciscoIqClient.js", () => ({
  CiscoIqClient: class {
    getInsights = getInsightsMock;
  },
}));

import { pool } from "../db.js";
import { runCiscoIqSync } from "../jobs/syncService.js";

describe("runCiscoIqSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips licenses with no property_id resolved (returns 0, never calls the client)", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockResolvedValueOnce({ rows: [] }); // the WHERE property_id IS NOT NULL query returns nothing

    const processed = await runCiscoIqSync();

    expect(processed).toBe(0);
    expect(getInsightsMock).not.toHaveBeenCalled();
  });

  it("creates a new technology row when the product_family doesn't exist yet, then upserts adoption + license usage", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query
      .mockResolvedValueOnce({
        rows: [{ license_id: "lic-1", smart_account: "MGM-SA", property_id: "prop-1" }],
      }) // license rows with resolved property_id
      .mockResolvedValueOnce({ rows: [] }) // technology lookup — not found
      .mockResolvedValueOnce({ rows: [{ technology_id: "tech-1" }] }) // technology insert
      .mockResolvedValueOnce({ rows: [{ adoption_id: "adopt-1" }] }) // property_technology_adoption upsert
      .mockResolvedValueOnce({ rows: [] }) // adoption_history insert
      .mockResolvedValueOnce({ rows: [] }); // property_license_usage upsert

    getInsightsMock.mockResolvedValueOnce([
      {
        product_family: "Meraki",
        entitled_quantity: 100,
        active_quantity: 40,
        deployment_phase: "pilot",
        health_score: 72,
      },
    ]);

    const processed = await runCiscoIqSync();

    expect(processed).toBe(1);
    expect(getInsightsMock).toHaveBeenCalledWith("MGM-SA");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cisco.technologies"),
      ["Meraki"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO mgm.property_technology_adoption"),
      ["prop-1", "tech-1", "pilot", 40, 72]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO mgm.property_license_usage"),
      ["prop-1", "lic-1", 100, 40]
    );
  });

  it("skips insights with no product_family rather than guessing a technology", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockResolvedValueOnce({
      rows: [{ license_id: "lic-1", smart_account: "MGM-SA", property_id: "prop-1" }],
    });

    getInsightsMock.mockResolvedValueOnce([{ active_quantity: 10 }]); // no product_family

    const processed = await runCiscoIqSync();

    expect(processed).toBe(0);
    // Only the initial license-rows query should have run — no technology/adoption writes.
    expect(query).toHaveBeenCalledTimes(1);
  });
});
