import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const cxRouter = Router();

interface CustomerHealthScore {
  score_id: string;
  customer_id: string;
  customer_name: string;
  health_score: number;
  adoption_score: number;
  engagement_score: number;
  risk_level: string;
  last_updated: string;
}

interface KpiRow {
  avg_score: string;
  total_customers: string;
  red_count: string;
  green_count: string;
}

interface KpiItem {
  label: string;
  value: number;
  unit: string;
}

// GET /health — customer health scores ordered by health_score ASC
cxRouter.get("/health", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<CustomerHealthScore>(`
      SELECT score_id, customer_id, customer_name, health_score,
             adoption_score, engagement_score, risk_level, last_updated
      FROM mgm.customer_health_scores
      ORDER BY health_score ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /kpis — compute KPIs from customer_health_scores
cxRouter.get("/kpis", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<KpiRow>(`
      SELECT
        ROUND(AVG(health_score), 1)::TEXT AS avg_score,
        COUNT(*)::TEXT AS total_customers,
        COUNT(*) FILTER (WHERE risk_level = 'red')::TEXT AS red_count,
        COUNT(*) FILTER (WHERE risk_level = 'green')::TEXT AS green_count
      FROM mgm.customer_health_scores
    `);

    const row = result.rows[0];
    const total = parseInt(row.total_customers, 10) || 0;
    const redCount = parseInt(row.red_count, 10) || 0;
    const greenCount = parseInt(row.green_count, 10) || 0;

    const kpis: KpiItem[] = [
      {
        label: "Avg Health Score",
        value: parseFloat(row.avg_score) || 0,
        unit: "pts"
      },
      {
        label: "Total Customers",
        value: total,
        unit: "customers"
      },
      {
        label: "% At Risk",
        value: total > 0 ? parseFloat(((redCount / total) * 100).toFixed(1)) : 0,
        unit: "%"
      },
      {
        label: "% Green",
        value: total > 0 ? parseFloat(((greenCount / total) * 100).toFixed(1)) : 0,
        unit: "%"
      }
    ];

    res.json(kpis);
  } catch (err) {
    next(err);
  }
});
