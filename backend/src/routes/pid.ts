import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const pidRouter = Router();

interface PostIncidentDoc {
  doc_id: string;
  incident_id: string;
  title: string;
  content: string;
  timeline: unknown[];
  root_cause: string | null;
  action_items: unknown[];
  generated_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const CreatePidSchema = z.object({
  incident_id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  timeline: z.array(z.unknown()).optional(),
  root_cause: z.string().optional(),
  action_items: z.array(z.unknown()).optional(),
  generated_by: z.string().optional()
});

const PatchPidSchema = z.object({
  content: z.string().min(1).optional(),
  root_cause: z.string().optional(),
  action_items: z.array(z.unknown()).optional(),
  timeline: z.array(z.unknown()).optional(),
  status: z.string().optional()
});

// GET / — list post-incident docs
pidRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<PostIncidentDoc>(`
      SELECT doc_id, incident_id, title, content, timeline, root_cause,
             action_items, generated_by, status, created_at, updated_at
      FROM mgm.post_incident_docs
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /:id — single post-incident doc
pidRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query<PostIncidentDoc>(`
      SELECT doc_id, incident_id, title, content, timeline, root_cause,
             action_items, generated_by, status, created_at, updated_at
      FROM mgm.post_incident_docs
      WHERE doc_id = $1
    `, [req.params.id]);

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST / — create a post-incident doc
pidRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = CreatePidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { incident_id, title, content, timeline, root_cause, action_items, generated_by } = parsed.data;

    const result = await pool.query<PostIncidentDoc>(`
      INSERT INTO mgm.post_incident_docs
        (incident_id, title, content, timeline, root_cause, action_items, generated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING doc_id, incident_id, title, content, timeline, root_cause,
                action_items, generated_by, status, created_at, updated_at
    `, [
      incident_id,
      title,
      content,
      JSON.stringify(timeline ?? []),
      root_cause ?? null,
      JSON.stringify(action_items ?? []),
      generated_by ?? "manual"
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update a post-incident doc
pidRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsed = PatchPidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { content, root_cause, action_items, timeline, status } = parsed.data;

    const result = await pool.query<PostIncidentDoc>(`
      UPDATE mgm.post_incident_docs
      SET
        content      = COALESCE($1, content),
        root_cause   = COALESCE($2, root_cause),
        action_items = COALESCE($3, action_items),
        timeline     = COALESCE($4, timeline),
        status       = COALESCE($5, status),
        updated_at   = NOW()
      WHERE doc_id = $6
      RETURNING doc_id, incident_id, title, content, timeline, root_cause,
                action_items, generated_by, status, created_at, updated_at
    `, [
      content ?? null,
      root_cause ?? null,
      action_items ? JSON.stringify(action_items) : null,
      timeline ? JSON.stringify(timeline) : null,
      status ?? null,
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
