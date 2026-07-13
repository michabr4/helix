/**
 * Goals & Loops routes — OKR-style goal tracking.
 *
 * GET   /goals              — list goals with nested key results + computed progress
 * GET   /goals/:id           — single goal with key results
 * POST  /goals               — create a goal
 * PATCH /goals/:id           — update goal fields (title, status, target_date, etc.)
 * POST  /goals/:id/key-results       — add a key result to a goal
 * PATCH /goals/key-results/:krId     — update a key result's current_value
 * GET   /goals/summary        — aggregate KPIs across all goals
 */
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const goalsRouter = Router();

const ALLOWED_CATEGORIES = ["customer", "team", "financial", "operational"];
const ALLOWED_STATUSES = ["on_track", "at_risk", "off_track", "completed"];
const ALLOWED_METRIC_TYPES = ["number", "percent", "currency", "boolean"];

interface GoalRow {
  goal_id: string;
  title: string;
  description: string | null;
  category: string;
  owner: string | null;
  status: string;
  start_date: string;
  target_date: string;
  created_at: string;
  updated_at: string;
}

interface KeyResultRow {
  kr_id: string;
  goal_id: string;
  title: string;
  metric_type: string;
  unit: string | null;
  start_value: string;
  current_value: string;
  target_value: string;
  updated_at: string;
}

function computeProgressPct(krs: KeyResultRow[]): number {
  if (krs.length === 0) return 0;
  const pcts = krs.map(kr => {
    const start = Number(kr.start_value);
    const target = Number(kr.target_value);
    const current = Number(kr.current_value);
    if (target === start) return current >= target ? 100 : 0;
    const pct = ((current - start) / (target - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  });
  return Math.round((pcts.reduce((sum, v) => sum + v, 0) / pcts.length) * 100) / 100;
}

async function attachKeyResults(goals: GoalRow[]) {
  if (goals.length === 0) return [];
  const goalIds = goals.map(g => g.goal_id);
  const krResult = await pool.query<KeyResultRow>(
    `SELECT kr_id, goal_id, title, metric_type, unit,
            start_value::text AS start_value, current_value::text AS current_value,
            target_value::text AS target_value, updated_at
     FROM mgm.key_results
     WHERE goal_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [goalIds]
  );

  const byGoal = new Map<string, KeyResultRow[]>();
  for (const kr of krResult.rows) {
    const list = byGoal.get(kr.goal_id) ?? [];
    list.push(kr);
    byGoal.set(kr.goal_id, list);
  }

  return goals.map(g => {
    const krs = byGoal.get(g.goal_id) ?? [];
    return {
      ...g,
      key_results: krs.map(kr => ({
        kr_id: kr.kr_id,
        title: kr.title,
        metric_type: kr.metric_type,
        unit: kr.unit,
        start_value: Number(kr.start_value),
        current_value: Number(kr.current_value),
        target_value: Number(kr.target_value),
        updated_at: kr.updated_at,
      })),
      progress_pct: computeProgressPct(krs),
    };
  });
}

// GET /goals — list all goals with nested key results
goalsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status && ALLOWED_STATUSES.includes(status)) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (category && ALLOWED_CATEGORIES.includes(category)) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query<GoalRow>(
      `SELECT goal_id, title, description, category, owner, status,
              start_date::text AS start_date, target_date::text AS target_date,
              created_at, updated_at
       FROM mgm.goals
       ${where}
       ORDER BY target_date ASC`,
      params
    );

    const withKrs = await attachKeyResults(result.rows);
    res.json(withKrs);
  } catch (err) {
    next(err);
  }
});

// GET /goals/summary — aggregate KPIs
goalsRouter.get("/summary", requireAuth, async (_req, res, next) => {
  try {
    const goalResult = await pool.query<GoalRow>(
      `SELECT goal_id, title, description, category, owner, status,
              start_date::text AS start_date, target_date::text AS target_date,
              created_at, updated_at
       FROM mgm.goals`
    );
    const withKrs = await attachKeyResults(goalResult.rows);

    const statusCounts: Record<string, number> = {};
    for (const g of withKrs) {
      statusCounts[g.status] = (statusCounts[g.status] ?? 0) + 1;
    }

    const avgProgress =
      withKrs.length > 0
        ? Math.round((withKrs.reduce((sum, g) => sum + g.progress_pct, 0) / withKrs.length) * 100) / 100
        : 0;

    const now = Date.now();
    const overdueCount = withKrs.filter(
      g => g.status !== "completed" && new Date(g.target_date).getTime() < now
    ).length;

    res.json({
      total_goals: withKrs.length,
      by_status: statusCounts,
      avg_progress_pct: avgProgress,
      overdue_goal_count: overdueCount,
    });
  } catch (err) {
    next(err);
  }
});

// GET /goals/:id — single goal with key results
goalsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query<GoalRow>(
      `SELECT goal_id, title, description, category, owner, status,
              start_date::text AS start_date, target_date::text AS target_date,
              created_at, updated_at
       FROM mgm.goals WHERE goal_id = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }
    const [withKrs] = await attachKeyResults(result.rows);
    res.json(withKrs);
  } catch (err) {
    next(err);
  }
});

// POST /goals — create a goal
goalsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, description, category, owner, target_date } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      owner?: string;
      target_date?: string;
    };

    if (!title || !target_date) {
      res.status(400).json({ message: "title and target_date are required" });
      return;
    }
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      res.status(400).json({ message: `category must be one of ${ALLOWED_CATEGORIES.join(", ")}` });
      return;
    }

    const result = await pool.query<GoalRow>(
      `INSERT INTO mgm.goals (title, description, category, owner, target_date)
       VALUES ($1, $2, COALESCE($3, 'team'), $4, $5)
       RETURNING goal_id, title, description, category, owner, status,
                 start_date::text AS start_date, target_date::text AS target_date,
                 created_at, updated_at`,
      [title, description ?? null, category ?? null, owner ?? null, target_date]
    );

    res.status(201).json({ ...result.rows[0], key_results: [], progress_pct: 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /goals/:id — update goal fields
goalsRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, description, category, owner, status, target_date } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      owner?: string;
      status?: string;
      target_date?: string;
    };

    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      res.status(400).json({ message: `category must be one of ${ALLOWED_CATEGORIES.join(", ")}` });
      return;
    }
    if (status && !ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ message: `status must be one of ${ALLOWED_STATUSES.join(", ")}` });
      return;
    }

    const result = await pool.query<GoalRow>(
      `UPDATE mgm.goals SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         owner = COALESCE($4, owner),
         status = COALESCE($5, status),
         target_date = COALESCE($6, target_date),
         updated_at = NOW()
       WHERE goal_id = $7
       RETURNING goal_id, title, description, category, owner, status,
                 start_date::text AS start_date, target_date::text AS target_date,
                 created_at, updated_at`,
      [title ?? null, description ?? null, category ?? null, owner ?? null, status ?? null, target_date ?? null, req.params.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }

    const [withKrs] = await attachKeyResults(result.rows);
    res.json(withKrs);
  } catch (err) {
    next(err);
  }
});

// POST /goals/:id/key-results — add a key result
goalsRouter.post("/:id/key-results", requireAuth, async (req, res, next) => {
  try {
    const { title, metric_type, unit, start_value, current_value, target_value } = req.body as {
      title?: string;
      metric_type?: string;
      unit?: string;
      start_value?: number;
      current_value?: number;
      target_value?: number;
    };

    if (!title || target_value === undefined) {
      res.status(400).json({ message: "title and target_value are required" });
      return;
    }
    if (metric_type && !ALLOWED_METRIC_TYPES.includes(metric_type)) {
      res.status(400).json({ message: `metric_type must be one of ${ALLOWED_METRIC_TYPES.join(", ")}` });
      return;
    }

    const goalCheck = await pool.query(`SELECT 1 FROM mgm.goals WHERE goal_id = $1`, [req.params.id]);
    if (goalCheck.rowCount === 0) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }

    const result = await pool.query<KeyResultRow>(
      `INSERT INTO mgm.key_results (goal_id, title, metric_type, unit, start_value, current_value, target_value)
       VALUES ($1, $2, COALESCE($3, 'number'), $4, COALESCE($5, 0), COALESCE($6, 0), $7)
       RETURNING kr_id, goal_id, title, metric_type, unit,
                 start_value::text AS start_value, current_value::text AS current_value,
                 target_value::text AS target_value, updated_at`,
      [req.params.id, title, metric_type ?? null, unit ?? null, start_value ?? null, current_value ?? null, target_value]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /goals/key-results/:krId — update a key result's current_value
goalsRouter.patch("/key-results/:krId", requireAuth, async (req, res, next) => {
  try {
    const { current_value } = req.body as { current_value?: number };
    if (current_value === undefined) {
      res.status(400).json({ message: "current_value is required" });
      return;
    }

    const result = await pool.query<KeyResultRow>(
      `UPDATE mgm.key_results SET current_value = $1, updated_at = NOW()
       WHERE kr_id = $2
       RETURNING kr_id, goal_id, title, metric_type, unit,
                 start_value::text AS start_value, current_value::text AS current_value,
                 target_value::text AS target_value, updated_at`,
      [current_value, req.params.krId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Key result not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
