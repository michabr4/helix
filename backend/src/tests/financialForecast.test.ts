/**
 * Tests for the Financial Forecast Agent's observe() logic.
 *
 * observe() calls SalesforceClient.isConfigured()/getOpportunities() — we
 * mock the integrations client so this runs without a real Salesforce org.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../integrations/salesforceClient.js", () => ({
  SalesforceClient: {
    isConfigured: vi.fn(),
    getOpportunities: vi.fn(),
  },
}));

import { SalesforceClient } from "../integrations/salesforceClient.js";
import { FinancialForecastAgent } from "../agents/financialForecast.js";

describe("FinancialForecastAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports not-configured when Salesforce is unavailable", async () => {
    (SalesforceClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const agent = new FinancialForecastAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["configured"]).toBe(false);
    expect(result.summary).toContain("not configured");
  });

  it("computes a probability-weighted forecast for open opportunities", async () => {
    (SalesforceClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (SalesforceClient.getOpportunities as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalSize: 3,
      done: true,
      records: [
        { Id: "o1", Name: "Deal A", StageName: "Negotiation", Amount: 100000, Probability: 50, CloseDate: "2099-01-01", FiscalYear: 2026, FiscalQuarter: 1 },
        { Id: "o2", Name: "Deal B", StageName: "Closed Won", Amount: 50000, Probability: 100, CloseDate: "2025-01-01" },
        { Id: "o3", Name: "Deal C", StageName: "Closed Lost", Amount: 20000, Probability: 0, CloseDate: "2025-01-01" },
      ],
    });

    const agent = new FinancialForecastAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    expect(data["open_opportunity_count"]).toBe(1);
    expect(data["closed_won_count"]).toBe(1);
    expect(data["total_weighted_pipeline"]).toBe(50000);
    expect(data["total_closed_won"]).toBe(50000);
  });

  it("flags opportunities closing within the closing-soon window", async () => {
    (SalesforceClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const soonDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    (SalesforceClient.getOpportunities as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        { Id: "o4", Name: "Deal D", StageName: "Negotiation", Amount: 30000, Probability: 80, CloseDate: soonDate },
      ],
    });

    const agent = new FinancialForecastAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const closingSoon = data["closing_soon_opportunities"] as Array<{ id: string }>;

    expect(closingSoon).toHaveLength(1);
    expect(closingSoon[0].id).toBe("o4");
    expect(data["closing_soon_value"]).toBe(30000);
  });

  it("act() is read-only and always returns an empty list", async () => {
    const agent = new FinancialForecastAgent();
    const done = await agent.act([
      { id: "noop", description: "n/a", requiresApproval: false, payload: {} },
    ]);
    expect(done).toEqual([]);
  });
});
