import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const tacRouter = Router();

tacRouter.get("/", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const result = await pool.query(
    `SELECT tac_case_id, case_number, severity, status, incident_id, last_update_at
     FROM cisco.tac_cases
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ limit, offset, rows: result.rows });
});
