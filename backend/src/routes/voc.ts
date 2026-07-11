import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const vocRouter = Router();

interface VocSignal {
  signal_id: string;
  source: string;
  sentiment_score: string;
  summary: string;
  raw_text: string | null;
  customer_id: string | null;
  customer_name: string | null;
  recorded_at: string;
}

interface VocSummaryRow {
  avg_score: string;
  total_signals: string;
  positive_count: string;
  neutral_count: string;
  negative_count: string;
}

const CreateSignalSchema = z.object({
  source: z.string().min(1),
  sentiment_score: z.number().min(0).max(10),
  summary: z.string().min(1),
  raw_text: z.string().optional(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional()
});

// GET /signals — list VOC signals, most recent first, limit 100
vocRouter.get("/signals", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<VocSignal>(`
      SELECT signal_id, source, sentiment_score, summary, raw_text,
             customer_id, customer_name, recorded_at
      FROM mgm.voc_signals
      ORDER BY recorded_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /summary — aggregate stats for VOC signals
vocRouter.get("/summary", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<VocSummaryRow>(`
      SELECT
        ROUND(AVG(sentiment_score), 2)::TEXT AS avg_score,
        COUNT(*)::TEXT AS total_signals,
        COUNT(*) FILTER (WHERE sentiment_score >= 7)::TEXT AS positive_count,
        COUNT(*) FILTER (WHERE sentiment_score >= 4 AND sentiment_score < 7)::TEXT AS neutral_count,
        COUNT(*) FILTER (WHERE sentiment_score < 4)::TEXT AS negative_count
      FROM mgm.voc_signals
    `);

    const row = result.rows[0];
    res.json({
      avg_score: parseFloat(row.avg_score) || 0,
      total_signals: parseInt(row.total_signals, 10) || 0,
      positive: parseInt(row.positive_count, 10) || 0,
      neutral: parseInt(row.neutral_count, 10) || 0,
      negative: parseInt(row.negative_count, 10) || 0
    });
  } catch (err) {
    next(err);
  }
});

// POST /signals — create a new VOC signal
vocRouter.post("/signals", requireAuth, async (req, res, next) => {
  try {
    const parsed = CreateSignalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { source, sentiment_score, summary, raw_text, customer_id, customer_name } = parsed.data;

    const result = await pool.query<VocSignal>(`
      INSERT INTO mgm.voc_signals
        (source, sentiment_score, summary, raw_text, customer_id, customer_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING signal_id, source, sentiment_score, summary, raw_text,
                customer_id, customer_name, recorded_at
    `, [
      source,
      sentiment_score,
      summary,
      raw_text ?? null,
      customer_id ?? null,
      customer_name ?? null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
