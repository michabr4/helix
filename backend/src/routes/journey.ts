import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const journeyRouter = Router();

interface JourneyMilestone {
  milestone_id: string;
  customer_id: string;
  customer_name: string;
  lifecycle_stage: string;
  health_score: number;
  phase: string;
  name: string;
  status: string;
  target_date: string;
  completed_date: string | null;
  owner: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

interface CustomerRef {
  customer_id: string;
  customer_name: string;
}

interface JourneyView {
  customer_id: string;
  customer_name: string;
  lifecycle_stage: string;
  health_score: number;
  milestones: JourneyMilestone[];
}

// GET / — journey data for a customer (first or ?customer_id=)
journeyRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const customerId = typeof req.query.customer_id === "string"
      ? req.query.customer_id
      : null;

    let customerRow: { customer_id: string; customer_name: string; lifecycle_stage: string; health_score: number } | null = null;

    if (customerId) {
      const headerResult = await pool.query<{
        customer_id: string;
        customer_name: string;
        lifecycle_stage: string;
        health_score: number;
      }>(`
        SELECT customer_id, customer_name, lifecycle_stage, health_score
        FROM mgm.journey_milestones
        WHERE customer_id = $1
        LIMIT 1
      `, [customerId]);

      if (headerResult.rowCount === 0) {
        res.status(404).json({ message: "Customer not found" });
        return;
      }
      customerRow = headerResult.rows[0];
    } else {
      const headerResult = await pool.query<{
        customer_id: string;
        customer_name: string;
        lifecycle_stage: string;
        health_score: number;
      }>(`
        SELECT customer_id, customer_name, lifecycle_stage, health_score
        FROM mgm.journey_milestones
        ORDER BY created_at ASC
        LIMIT 1
      `);

      if (headerResult.rowCount === 0) {
        res.json(null);
        return;
      }
      customerRow = headerResult.rows[0];
    }

    const milestonesResult = await pool.query<JourneyMilestone>(`
      SELECT milestone_id, customer_id, customer_name, lifecycle_stage, health_score,
             phase, name, status, target_date, completed_date, owner, notes, sort_order, created_at
      FROM mgm.journey_milestones
      WHERE customer_id = $1
      ORDER BY sort_order ASC
    `, [customerRow.customer_id]);

    const journey: JourneyView = {
      customer_id: customerRow.customer_id,
      customer_name: customerRow.customer_name,
      lifecycle_stage: customerRow.lifecycle_stage,
      health_score: customerRow.health_score,
      milestones: milestonesResult.rows
    };

    res.json(journey);
  } catch (err) {
    next(err);
  }
});

// GET /customers — distinct customers in journey_milestones
journeyRouter.get("/customers", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<CustomerRef>(`
      SELECT DISTINCT customer_id, customer_name
      FROM mgm.journey_milestones
      ORDER BY customer_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});
