import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const checks: Record<string, "ok" | "degraded"> = {};

  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "degraded";
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "degraded";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  // 200 if fully healthy; 207 Multi-Status if any component is degraded.
  // Avoids triggering a hard load-balancer failure on partial Redis outages.
  res.status(allOk ? 200 : 207).json({
    status: allOk ? "ok" : "degraded",
    checks
  });
});
