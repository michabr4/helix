/**
 * Tests for the VoC Synthesis & Trend Agent.
 *
 * observe() is pure SQL aggregation (mocked via ../db.js). act() calls the
 * LLM wrapper (mocked via ../agents/llm.js) to synthesize themes.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../agents/llm.js", () => ({
  llm: vi.fn().mockResolvedValue("Theme 1: Slow response times (3 signals). Next step: staff review."),
  llmJson: vi.fn(),
}));

import { pool } from "../db.js";
import { llm } from "../agents/llm.js";
import { VocSynthesisAgent } from "../agents/vocSynthesis.js";

function mockQueryResults(
  bySource: unknown[],
  byCustomer: unknown[],
  recentPeriod: unknown[],
  priorPeriod: unknown[],
  detractors: unknown[]
) {
  const query = pool.query as ReturnType<typeof vi.fn>;
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: bySource })
    .mockResolvedValueOnce({ rows: byCustomer })
    .mockResolvedValueOnce({ rows: recentPeriod })
    .mockResolvedValueOnce({ rows: priorPeriod })
    .mockResolvedValueOnce({ rows: detractors });
}

describe("VocSynthesisAgent.observe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags sentiment decline when recent avg drops >=1.0 vs prior period", async () => {
    mockQueryResults(
      [],
      [],
      [{ avg_sentiment: "5.0", signal_count: "10" }],
      [{ avg_sentiment: "7.0", signal_count: "12" }],
      []
    );

    const agent = new VocSynthesisAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;

    expect(data["trend_delta"]).toBe(-2);
    expect(data["sentiment_declining"]).toBe(true);
  });

  it("does not flag decline for a small delta", async () => {
    mockQueryResults(
      [],
      [],
      [{ avg_sentiment: "6.5", signal_count: "10" }],
      [{ avg_sentiment: "7.0", signal_count: "12" }],
      []
    );

    const agent = new VocSynthesisAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;

    expect(data["sentiment_declining"]).toBe(false);
  });

  it("aggregates per-source and per-customer averages", async () => {
    mockQueryResults(
      [{ source: "survey", avg_sentiment: "4.5", signal_count: "3" }],
      [{ customer_id: "c1", customer_name: "Acme", avg_sentiment: "3.0", signal_count: "2" }],
      [{ avg_sentiment: null, signal_count: "0" }],
      [{ avg_sentiment: null, signal_count: "0" }],
      []
    );

    const agent = new VocSynthesisAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;

    expect(data["by_source"]).toEqual([{ source: "survey", avg_sentiment: 4.5, signal_count: 3 }]);
    expect(data["by_customer"]).toEqual([
      { customer_id: "c1", customer_name: "Acme", avg_sentiment: 3, signal_count: 2 },
    ]);
  });

  it("returns null trend fields when there's no data in either period", async () => {
    mockQueryResults([], [], [{ avg_sentiment: null, signal_count: "0" }], [{ avg_sentiment: null, signal_count: "0" }], []);

    const agent = new VocSynthesisAgent();
    const result = await agent.observe({});
    const data = result.data as Record<string, unknown>;

    expect(data["trend_delta"]).toBeNull();
    expect(data["sentiment_declining"]).toBe(false);
  });
});

describe("VocSynthesisAgent.act", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("synthesizes detractor signals into a themed digest via the LLM", async () => {
    const agent = new VocSynthesisAgent();
    const done = await agent.act([
      {
        id: "synthesize_voc_trends",
        description: "Synthesize VoC themes",
        requiresApproval: false,
        payload: {
          detractor_signals: [
            { source: "survey", sentiment_score: "2", summary: "Slow response", customer_name: "Acme", recorded_at: "2026-01-01" },
          ],
          sentiment_declining: true,
          trend_delta: -2,
        },
      },
    ]);

    expect(llm).toHaveBeenCalledTimes(1);
    expect(done).toEqual(["Theme 1: Slow response times (3 signals). Next step: staff review."]);
  });

  it("ignores actions that are not synthesize_voc_trends", async () => {
    const agent = new VocSynthesisAgent();
    const done = await agent.act([
      { id: "unrelated", description: "n/a", requiresApproval: false, payload: {} },
    ]);

    expect(llm).not.toHaveBeenCalled();
    expect(done).toEqual([]);
  });
});
