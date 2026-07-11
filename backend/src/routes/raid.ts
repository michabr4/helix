import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const raidRouter = Router();

interface RaidItem {
  item_id: string;
  category: string;
  title: string;
  description: string | null;
  owner: string | null;
  severity: string;
  status: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const CreateRaidSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  due_date: z.string().optional()
});

const PatchRaidSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.string().optional(),
  due_date: z.string().nullable().optional()
});

// GET / — list RAID items, optional ?category= and ?status= filters
raidRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.category && typeof req.query.category === "string") {
      params.push(req.query.category);
      conditions.push(`category = $${params.length}`);
    }
    if (req.query.status && typeof req.query.status === "string") {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query<RaidItem>(`
      SELECT item_id, category, title, description, owner, severity, status,
             due_date, created_by, created_at, updated_at
      FROM mgm.raid_items
      ${where}
      ORDER BY created_at DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST / — create a RAID item
raidRouter.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = CreateRaidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { category, title, description, owner, severity, due_date } = parsed.data;

    const result = await pool.query<RaidItem>(`
      INSERT INTO mgm.raid_items
        (category, title, description, owner, severity, due_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING item_id, category, title, description, owner, severity, status,
                due_date, created_by, created_at, updated_at
    `, [
      category,
      title,
      description ?? null,
      owner ?? null,
      severity ?? "medium",
      due_date ?? null,
      req.auth.userId
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update a RAID item
raidRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsed = PatchRaidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { title, description, owner, severity, status, due_date } = parsed.data;

    const result = await pool.query<RaidItem>(`
      UPDATE mgm.raid_items
      SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        owner       = COALESCE($3, owner),
        severity    = COALESCE($4, severity),
        status      = COALESCE($5, status),
        due_date    = COALESCE($6, due_date),
        updated_at  = NOW()
      WHERE item_id = $7
      RETURNING item_id, category, title, description, owner, severity, status,
                due_date, created_by, created_at, updated_at
    `, [
      title ?? null,
      description ?? null,
      owner ?? null,
      severity ?? null,
      status ?? null,
      due_date ?? null,
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

// DELETE /:id — delete a RAID item
raidRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM mgm.raid_items WHERE item_id = $1 RETURNING item_id",
      [req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
