/**
 * Tests for the QBR/EBR Content Assembly Agent's observe()/act() logic.
 *
 * observe() aggregates the upcoming-review query plus, per review, three
 * customer-keyed queries (health/voc/sla) and — when a property_id is set —
 * three more property-keyed queries (incidents/adoption/licenses). We mock
 * ../db.js so this runs without a real Postgres instance. act() calls the
 * LLM helper and a DB write, both mocked/spied.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "../db.js";
import { QbrAssemblyAgent } from "../agents/qbrAssembly.js";

describe("QbrAssemblyAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles context for a customer-only review (no property_id)", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockReset();
    query
      .mockResolvedValueOnce({
        rows: [
          {
            qbr_id: "q1",
            customer_id: "cust-1",
            customer_name: "Acme Corp",
            property_id: null,
            scheduled_date: "2025-02-01",
            cadence: "quarterly",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ health_score: 80, adoption_score: 70, engagement_score: 75, risk_level: "green", last_updated: "2025-01-01" }] })
      .mockResolvedValueOnce({ rows: [{ source: "survey", sentiment_score: 8, summary: "Positive", recorded_at: "2025-01-01" }] })
      .mockResolvedValueOnce({ rows: [{ sla_type: "response", target_hours: 4, actual_hours: 2, breached: false, created_at: "2025-01-01", resolved_at: "2025-01-01" }] });

    const agent = new QbrAssemblyAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const reviews = data["upcoming_reviews"] as Array<{ qbr_id: string; property_context: unknown }>;
    const gaps = data["data_gaps"] as string[];

    expect(reviews).toHaveLength(1);
    expect(reviews[0].qbr_id).toBe("q1");
    expect(reviews[0].property_context).toBeNull();
    expect(gaps.length).toBe(1);
  });

  it("includes property context when property_id is set", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockReset();
    query
      .mockResolvedValueOnce({
        rows: [
          {
            qbr_id: "q2",
            customer_id: "cust-2",
            customer_name: "Beta LLC",
            property_id: "prop-1",
            scheduled_date: "2025-02-01",
            cadence: "quarterly",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // health
      .mockResolvedValueOnce({ rows: [] }) // voc
      .mockResolvedValueOnce({ rows: [] }) // sla
      .mockResolvedValueOnce({ rows: [{ incident_number: "INC-001", title: "Outage", priority: "P1", status: "resolved", created_at: "2025-01-01" }] })
      .mockResolvedValueOnce({ rows: [{ technology_name: "Catalyst Center", deployment_phase: "production", devices_deployed: 10, health_status: "healthy" }] })
      .mockResolvedValueOnce({ rows: [{ product_name: "DNA Center Advantage", quantity_used: 50, quantity_purchased: 100 }] });

    const agent = new QbrAssemblyAgent();
    const result = await agent.observe({});

    const data = result.data as Record<string, unknown>;
    const reviews = data["upcoming_reviews"] as Array<{ qbr_id: string; property_context: { recent_incidents: unknown[] } | null }>;
    const gaps = data["data_gaps"] as string[];

    expect(reviews).toHaveLength(1);
    expect(reviews[0].property_context).not.toBeNull();
    expect(reviews[0].property_context?.recent_incidents).toHaveLength(1);
    expect(gaps).toHaveLength(0);
  });

  it("act() drafts QBR content and persists it back to mgm.qbr_schedule", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query.mockReset();
    query.mockResolvedValue({ rows: [] });

    const agent = new QbrAssemblyAgent();
    const llmSpy = vi.spyOn(agent as unknown as { llm: (p: string) => Promise<string> }, "llm")
      .mockResolvedValue("Executive Summary: all good.");

    const done = await agent.act([
      {
        id: "assemble_qbr_content",
        description: "n/a",
        requiresApproval: false,
        payload: { qbrId: "q1", customerName: "Acme Corp", context: "some context" },
      },
    ]);

    expect(llmSpy).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE mgm.qbr_schedule"),
      ["Executive Summary: all good.", "q1"]
    );
    expect(done).toHaveLength(1);
    expect(done[0]).toContain("q1");
  });
});
