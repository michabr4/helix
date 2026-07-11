import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const securityRouter = Router();

interface PsirtAdvisory {
  advisory_id: string;
  title: string;
  severity: string;
  cvss_score: string | null;
  affected_products: unknown[];
  published_at: string;
  status: string;
  raw_json: unknown | null;
  created_at: string;
}

interface FieldNotice {
  fn_id: string;
  title: string;
  affected_products: unknown[];
  workaround_available: boolean;
  published_at: string;
  url: string | null;
  raw_json: unknown | null;
  created_at: string;
}

// GET /psirt — list PSIRT advisories, optional ?severity= filter
securityRouter.get("/psirt", requireAuth, async (req, res, next) => {
  try {
    const { severity } = req.query;
    let query: string;
    let params: unknown[];

    if (severity && typeof severity === "string") {
      query = `
        SELECT advisory_id, title, severity, cvss_score, affected_products,
               published_at, status, raw_json, created_at
        FROM mgm.psirt_advisories
        WHERE severity = $1
        ORDER BY published_at DESC
      `;
      params = [severity];
    } else {
      query = `
        SELECT advisory_id, title, severity, cvss_score, affected_products,
               published_at, status, raw_json, created_at
        FROM mgm.psirt_advisories
        ORDER BY published_at DESC
      `;
      params = [];
    }

    const result = await pool.query<PsirtAdvisory>(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /field-notices — list field notices
securityRouter.get("/field-notices", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<FieldNotice>(`
      SELECT fn_id, title, affected_products, workaround_available,
             published_at, url, raw_json, created_at
      FROM mgm.field_notices
      ORDER BY published_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});
