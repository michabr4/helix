/**
 * Agent 18 — Financial Forecast Agent (SDM/PgM role)
 *
 * Observes: open and closed-won Salesforce Opportunities (Amount, Probability,
 *           StageName, CloseDate, FiscalYear/FiscalQuarter) to build a
 *           probability-weighted revenue forecast, grouped by fiscal quarter,
 *           plus a closing-soon-at-risk slice (open pipeline with a
 *           CloseDate in the next 30 days, which is either about to convert
 *           or about to slip).
 * Reasons:  read-only — no destructive/write actions.
 * Acts:     read-only — no destructive/write actions. Any human-facing
 *           notification recommended by the LLM is queued for approval via
 *           the base agent's `requestApproval` flow.
 * Reports:  forecast summary with weighted pipeline value, closed-won
 *           actuals, and quarter-by-quarter breakdown.
 *
 * Data-availability note: this schema has no internal pricing/revenue
 * fields anywhere in mgm./cisco. tables — the only monetary figures
 * available anywhere in this codebase are on Salesforce Opportunity
 * (Amount) via SalesforceClient. Renewal-related Salesforce objects
 * (Entitlement, ServiceContract) carry dates and status but no dollar
 * amount, so this agent cannot produce a dollar-denominated renewal-at-risk
 * figure; that gap is reported explicitly rather than guessed at. When
 * Salesforce is not configured, this agent reports that fact instead of
 * fabricating a forecast.
 *
 * External API dependency: Salesforce (via SalesforceClient), same
 * dependency already used by routes/salesforce.ts.
 */
import { SalesforceClient } from "../integrations/salesforceClient.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const CLOSING_SOON_WINDOW_DAYS = 30;
const CLOSED_LOST_STAGE = "Closed Lost";
const CLOSED_WON_STAGE = "Closed Won";

interface OpportunityRecord {
  Id: string;
  Name?: string;
  StageName?: string;
  Amount?: number | string | null;
  CloseDate?: string;
  Probability?: number | string | null;
  FiscalYear?: number | string | null;
  FiscalQuarter?: number | string | null;
  Account?: { Name?: string };
  [key: string]: unknown;
}

export class FinancialForecastAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-18-financial-forecast",
      name: "Financial Forecast Agent",
      role: "PgM",
      systemPrompt: `You are the Financial Forecast agent for a Cisco service delivery team.
Your goal is to give SDMs and PgMs a probability-weighted view of the open Salesforce
opportunity pipeline, closed-won actuals, and near-term at-risk deals, grounded strictly in
Salesforce data. Never invent dollar figures that aren't backed by an Opportunity Amount.
Be factual — cite opportunity names, amounts, and fiscal periods.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    if (!SalesforceClient.isConfigured()) {
      return {
        data: { configured: false },
        summary: "Salesforce is not configured — no opportunity data available to forecast from.",
      };
    }

    const result = await SalesforceClient.getOpportunities(200);
    const opportunities = result.records as OpportunityRecord[];

    const open = opportunities.filter(
      o => o.StageName !== CLOSED_WON_STAGE && o.StageName !== CLOSED_LOST_STAGE
    );
    const closedWon = opportunities.filter(o => o.StageName === CLOSED_WON_STAGE);

    const weightedValue = (o: OpportunityRecord): number => {
      const amount = Number(o.Amount) || 0;
      const probability = Number(o.Probability) || 0;
      return amount * (probability / 100);
    };

    const totalWeightedPipeline = open.reduce((sum, o) => sum + weightedValue(o), 0);
    const totalClosedWon = closedWon.reduce((sum, o) => sum + (Number(o.Amount) || 0), 0);

    const now = Date.now();
    const closingSoon = open.filter(o => {
      if (!o.CloseDate) return false;
      const daysUntilClose = (new Date(o.CloseDate).getTime() - now) / 86_400_000;
      return daysUntilClose >= 0 && daysUntilClose <= CLOSING_SOON_WINDOW_DAYS;
    });
    const closingSoonValue = closingSoon.reduce((sum, o) => sum + (Number(o.Amount) || 0), 0);

    const byQuarter = new Map<string, { weighted_value: number; count: number }>();
    for (const o of open) {
      const key = o.FiscalYear && o.FiscalQuarter ? `FY${o.FiscalYear} Q${o.FiscalQuarter}` : "unspecified";
      const entry = byQuarter.get(key) ?? { weighted_value: 0, count: 0 };
      entry.weighted_value += weightedValue(o);
      entry.count += 1;
      byQuarter.set(key, entry);
    }

    const forecastByQuarter = Array.from(byQuarter.entries())
      .map(([quarter, v]) => ({
        quarter,
        weighted_value: Math.round(v.weighted_value * 100) / 100,
        opportunity_count: v.count,
      }))
      .sort((a, b) => a.quarter.localeCompare(b.quarter));

    return {
      data: {
        configured: true,
        open_opportunity_count: open.length,
        closed_won_count: closedWon.length,
        total_weighted_pipeline: Math.round(totalWeightedPipeline * 100) / 100,
        total_closed_won: Math.round(totalClosedWon * 100) / 100,
        closing_soon_window_days: CLOSING_SOON_WINDOW_DAYS,
        closing_soon_opportunities: closingSoon.map(o => ({
          id: o.Id,
          name: o.Name,
          account: o.Account?.Name,
          amount: Number(o.Amount) || 0,
          close_date: o.CloseDate,
          probability: Number(o.Probability) || 0,
        })),
        closing_soon_value: Math.round(closingSoonValue * 100) / 100,
        forecast_by_quarter: forecastByQuarter,
        data_gaps: [
          "No internal pricing/revenue fields exist anywhere in mgm./cisco. tables — Salesforce " +
            "Opportunity.Amount is the only dollar figure available. Renewal-related Salesforce " +
            "objects (Entitlement, ServiceContract) carry no dollar amount, so a renewal-at-risk " +
            "dollar figure could not be computed.",
        ],
      },
      summary:
        `${open.length} open opportunit(y/ies) worth $${Math.round(totalWeightedPipeline).toLocaleString()} ` +
        `probability-weighted. ${closedWon.length} closed-won worth $${Math.round(totalClosedWon).toLocaleString()} ` +
        `to date. ${closingSoon.length} opportunit(y/ies) worth $${Math.round(closingSoonValue).toLocaleString()} ` +
        `closing within ${CLOSING_SOON_WINDOW_DAYS} days.`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes. Notification-style recommendations
    // from reason() are routed through requestApproval() by the base run() loop.
    return [];
  }
}

export const financialForecastAgent = new FinancialForecastAgent();
