/**
 * Tests for the Executive Communications Drafting Agent.
 *
 * observe() branches on incidentId / customerId / generic fallback — all
 * pure SQL aggregation, mocked via ../db.js. act() calls the LLM wrapper,
 * mocked via ../agents/llm.js so no real Anthropic API key is required.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../agents/llm.js", () => ({
  llm: vi.fn().mockResolvedValue("Subject: Draft\n\nThis is a draft communication."),
  llmJson: vi.fn(),
}));

import { pool } from "../db.js";
import { llm } from "../agents/llm.js";
import { ExecCommsAgent } from "../agents/execComms.js";

describe("ExecCommsAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grounds the draft in a specific incident when incidentId is given", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ incident_id: "i1", incident_number: "INC-1", title: "Outage", updates: [] }],
    });

    const agent = new ExecCommsAgent();
    const result = await agent.observe({ audience: "customer_exec", incidentId: "i1" });
    const data = result.data as Record<string, unknown>;

    expect(data["context_type"]).toBe("incident");
    expect((data["incident"] as { incident_id: string }).incident_id).toBe("i1");
  });

  it("reports found:false when the incidentId does not exist", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const agent = new ExecCommsAgent();
    const result = await agent.observe({ incidentId: "missing" });
    const data = result.data as Record<string, unknown>;

    expect(data["found"]).toBe(false);
  });

  it("grounds the draft in customer health/VoC/SLA data when customerId is given", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ customer_id: "c1", health_score: 42 }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ source: "survey", sentiment_score: 3 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ sla_type: "response", breached: true }] });

    const agent = new ExecCommsAgent();
    const result = await agent.observe({ audience: "internal_leadership", customerId: "c1" });
    const data = result.data as Record<string, unknown>;

    expect(data["context_type"]).toBe("customer");
    expect((data["health"] as { customer_id: string }).customer_id).toBe("c1");
    expect((data["recent_voc"] as unknown[])).toHaveLength(1);
    expect((data["recent_sla"] as unknown[])).toHaveLength(1);
  });

  it("falls back to a generic snapshot when no incidentId or customerId is given", async () => {
    const query = pool.query as ReturnType<typeof vi.fn>;
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ incident_number: "INC-9", priority: "P1" }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ sla_type: "response", target_hours: 4, elapsed_hours: "3.6" }],
      });

    const agent = new ExecCommsAgent();
    const result = await agent.observe({ audience: "internal_leadership" });
    const data = result.data as Record<string, unknown>;

    expect(data["context_type"]).toBe("generic");
    expect((data["open_high_severity_incidents"] as unknown[])).toHaveLength(1);
    expect((data["at_risk_sla"] as unknown[])).toHaveLength(1); // 3.6/4 = 0.9 >= 0.8 threshold
  });
});

describe("ExecCommsAgent.act", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drafts communication text via the LLM for a draft_comms action", async () => {
    const agent = new ExecCommsAgent();
    const done = await agent.act([
      {
        id: "draft_comms",
        description: "Draft the exec update",
        requiresApproval: false,
        payload: { audience: "customer_exec", topic: "Outage recap", context: "INC-1 resolved in 2h" },
      },
    ]);

    expect(llm).toHaveBeenCalledTimes(1);
    expect(done).toEqual(["Subject: Draft\n\nThis is a draft communication."]);
  });

  it("ignores actions that are not draft_comms", async () => {
    const agent = new ExecCommsAgent();
    const done = await agent.act([
      { id: "unrelated", description: "n/a", requiresApproval: false, payload: {} },
    ]);

    expect(llm).not.toHaveBeenCalled();
    expect(done).toEqual([]);
  });
});
