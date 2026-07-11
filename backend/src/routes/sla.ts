import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const slaRouter = Router();

interface SlaRecord {
  sla_id: string;
  incident_id: string;
  customer_id: string | null;
  sla_type: string;
  target_hours: string;
  actual_hours: string | null;
  breached: boolean;
  breach_reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

const CreateSlaSchema = z.object({
  incident_id: z.string().min(1),
  customer_id: z.string().optional(),
  sla_type: z.string().min(1),
  target_hours: z.number().positive()
});

const PatchSlaSchema = z.object({
  actual_hours: z.number().nonnegative().optional(),
  breached: z.boolean().optional(),
  breach_reason: z.string().optional()
});

// GET / — list SLA records, optional ?breached=true filter
slaRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    let query: string;
    let params: unknown[];

    if (req.query.breached === "true") {
      query = `
        SELECT sla_id, incident_id, customer_id, sla_type, target_hours, actual_hours,
               breached, breach_reason, created_at, resolved_at
        FROM mgm.sla_records
        WHERE breached = TRUE
        ORDER BY created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT sla_id, incident_id, customer_id, sla_type, target_hours, actual_hours,
               breached, breach_reason, created_at, resolved_at
        FROM mgm.sla_records
        ORDER BY created_at DESC
      `;
      params = [];
    }

    const result = await pool.query<SlaRecord>(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST / — create a new SLA record
slaRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = CreateSlaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { incident_id, customer_id, sla_type, target_hours } = parsed.data;

    const result = await pool.query<SlaRecord>(`
      INSERT INTO mgm.sla_records (incident_id, customer_id, sla_type, target_hours)
      VALUES ($1, $2, $3, $4)
      RETURNING sla_id, incident_id, customer_id, sla_type, target_hours, actual_hours,
                breached, breach_reason, created_at, resolved_at
    `, [
      incident_id,
      customer_id ?? null,
      sla_type,
      target_hours
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update actual_hours, breached, breach_reason, set resolved_at=NOW()
slaRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsed = PatchSlaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { actual_hours, breached, breach_reason } = parsed.data;

    const result = await pool.query<SlaRecord>(`
      UPDATE mgm.sla_records
      SET
        actual_hours  = COALESCE($1, actual_hours),
        breached      = COALESCE($2, breached),
        breach_reason = COALESCE($3, breach_reason),
        resolved_at   = NOW()
      WHERE sla_id = $4
      RETURNING sla_id, incident_id, customer_id, sla_type, target_hours, actual_hours,
                breached, breach_reason, created_at, resolved_at
    `, [
      actual_hours ?? null,
      breached ?? null,
      breach_reason ?? null,
      req.params.id
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
