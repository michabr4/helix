/**
 * Agent management routes
 *
 * GET  /api/agents/status           — current status of all registered agents
 * GET  /api/agents/approvals/pending — approval requests awaiting human review
 * POST /api/agents/approvals/:id/approve — approve a pending action
 * POST /api/agents/approvals/:id/reject  — reject a pending action
 * POST /api/agents/run              — trigger an agent manually (admin only)
 */
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../middleware/auth.js";
import { slaMonitorAgent } from "../agents/slaMonitor.js";
import { incidentFirstResponseAgent } from "../agents/incidentFirstResponse.js";
import { statusReportAgent } from "../agents/statusReport.js";
import { postIncidentDocAgent } from "../agents/postIncidentDoc.js";

export const agentsRouter = Router();

// Registry of all available agents
const AGENT_REGISTRY = [
  slaMonitorAgent,
  incidentFirstResponseAgent,
  statusReportAgent,
  postIncidentDocAgent,
];

/** GET /api/agents/status — list agents with latest job status */
agentsRouter.get("/status", requireAuth, async (_req, res, next) => {
  try {
    // Get most recent job per agent
    const result = await pool.query(`
      SELECT DISTINCT ON (agent_id)
        agent_id,
        agent_name,
        role,
        status,
        started_at AS last_run,
        output->>'title' AS last_action
      FROM mgm.agent_jobs
      ORDER BY agent_id, created_at DESC
    `);

    // Build a map of DB rows
    const dbMap = new Map(result.rows.map(r => [r.agent_id as string, r]));

    // Merge with registry to include agents that have never run
    const pending = await pool.query(`
      SELECT agent_id, COUNT(*) AS pending_count
      FROM mgm.agent_approvals WHERE status = 'pending'
      GROUP BY agent_id
    `);
    const pendingMap = new Map(pending.rows.map(r => [r.agent_id as string, Number(r.pending_count)]));

    const statusList = AGENT_REGISTRY.map(agent => ({
      agent_id: agent.agentId,
      name: agent.name,
      role: agent.role,
      status: dbMap.get(agent.agentId)?.status ?? "idle",
      last_run: dbMap.get(agent.agentId)?.last_run ?? null,
      last_action: dbMap.get(agent.agentId)?.last_action ?? null,
      pending_count: pendingMap.get(agent.agentId) ?? 0,
    }));

    res.json(statusList);
  } catch (err) {
    next(err);
  }
});

/** GET /api/agents/approvals/pending */
agentsRouter.get("/approvals/pending", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT request_id, agent_id, agent_name, action, context, requested_at
      FROM mgm.agent_approvals
      WHERE status = 'pending'
      ORDER BY requested_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/** POST /api/agents/approvals/:id/approve */
agentsRouter.post(
  "/approvals/:id/approve",
  requireAuth,
  requireRoles(["admin", "sdm"]),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

      const result = await pool.query(
        `UPDATE mgm.agent_approvals
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
         WHERE request_id = $2 AND status = 'pending'
         RETURNING request_id, status`,
        [req.auth.userId, req.params.id]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: "Approval request not found or already reviewed" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/agents/approvals/:id/reject */
agentsRouter.post(
  "/approvals/:id/reject",
  requireAuth,
  requireRoles(["admin", "sdm"]),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

      const result = await pool.query(
        `UPDATE mgm.agent_approvals
         SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
         WHERE request_id = $2 AND status = 'pending'
         RETURNING request_id, status`,
        [req.auth.userId, req.params.id]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: "Approval request not found or already reviewed" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/agents/run — manually trigger an agent */
agentsRouter.post(
  "/run",
  requireAuth,
  requireRoles(["admin"]),
  async (req, res, next) => {
    try {
      const { agentId, input } = req.body as { agentId: string; input?: Record<string, unknown> };

      const agent = AGENT_REGISTRY.find(a => a.agentId === agentId);
      if (!agent) {
        res.status(404).json({ message: `Agent '${agentId}' not found` });
        return;
      }

      // Run async — return job ID immediately so the caller can poll
      const jobProm = agent.run(input ?? {});
      jobProm.catch(err => {
        console.error(JSON.stringify({
          level: "error",
          message: "agent_run_failed",
          agentId,
          error: String(err)
        }));
      });

      res.status(202).json({
        message: "Agent run started",
        agentId,
        note: "Poll GET /api/agents/status for completion"
      });
    } catch (err) {
      next(err);
    }
  }
);
