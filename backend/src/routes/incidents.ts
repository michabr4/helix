import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { audit } from "../middleware/audit.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../middleware/auth.js";

export const incidentsRouter = Router();

/** Roles that see all incidents across all properties. */
const PRIVILEGED_ROLES = new Set(["admin", "sdm", "tam", "csm", "engineer", "manager"]);

const CreateIncident = z.object({
  propertyId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  title: z.string().min(5),
  description: z.string().min(5),
  priority: z.enum(["P1", "P2", "P3", "P4"])
});

const PatchIncident = z.object({
  status: z.enum([
    "open",
    "acknowledged",
    "investigating",
    "in-progress",
    "pending",
    "resolved",
    "closed",
    "cancelled"
  ])
});

const UpdatePayload = z.object({
  content: z.string().min(1)
});

const TacLinkPayload = z.object({
  tacCaseNumber: z.string().min(3),
  tacSeverity: z.enum(["1", "2", "3", "4"])
});

const SELECT_COLS =
  "incident_id, incident_number, property_id, device_id, title, priority, status, tac_case_number";

// GET / — all incidents (privileged) or own incidents (viewer)
incidentsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

  if (PRIVILEGED_ROLES.has(req.auth.role)) {
    const result = await pool.query(
      `SELECT ${SELECT_COLS} FROM mgm.incidents ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } else {
    // Viewer: only incidents the user reported or is assigned to
    const result = await pool.query(
      `SELECT ${SELECT_COLS} FROM mgm.incidents
       WHERE reported_by = $1 OR assigned_to = $1
       ORDER BY created_at DESC`,
      [req.auth.userId]
    );
    res.json(result.rows);
  }
});

// GET /:incidentId — single incident
incidentsRouter.get("/:incidentId", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

  const result = await pool.query(
    `SELECT ${SELECT_COLS}, description, reported_by, assigned_to, created_at, updated_at
     FROM mgm.incidents WHERE incident_id = $1`,
    [req.params.incidentId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  const row = result.rows[0];

  // Viewer can only read incidents they own
  if (!PRIVILEGED_ROLES.has(req.auth.role)) {
    if (row.reported_by !== req.auth.userId && row.assigned_to !== req.auth.userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
  }

  res.json(row);
});

incidentsRouter.post(
  "/",
  requireAuth,
  requireRoles(["admin", "sdm", "tam", "csm", "engineer", "manager"]),
  audit("incident.create"),
  async (req: AuthedRequest, res) => {
    const parsed = CreateIncident.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO mgm.incidents
       (property_id, device_id, title, description, priority, status, reported_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $6)
       RETURNING incident_id, incident_number, title, priority, status`,
      [
        parsed.data.propertyId,
        parsed.data.deviceId ?? null,
        parsed.data.title,
        parsed.data.description,
        parsed.data.priority,
        req.auth.userId
      ]
    );
    res.status(201).json(result.rows[0]);
  }
);

incidentsRouter.patch(
  "/:incidentId",
  requireAuth,
  requireRoles(["admin", "sdm", "tam", "engineer", "manager"]),
  audit("incident.status.update"),
  async (req, res) => {
    const parsed = PatchIncident.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      "UPDATE mgm.incidents SET status = $1 WHERE incident_id = $2 RETURNING incident_id, status",
      [parsed.data.status, req.params.incidentId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(result.rows[0]);
  }
);

incidentsRouter.post(
  "/:incidentId/updates",
  requireAuth,
  audit("incident.update.create"),
  async (req: AuthedRequest, res) => {
    const parsed = UpdatePayload.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO mgm.incident_updates (incident_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING update_id, incident_id, user_id, content, created_at`,
      [req.params.incidentId, req.auth.userId, parsed.data.content]
    );
    res.status(201).json(result.rows[0]);
  }
);

incidentsRouter.post(
  "/:incidentId/tac-link",
  requireAuth,
  requireRoles(["admin", "sdm", "tam", "engineer"]),
  audit("incident.tac.link"),
  async (req, res) => {
    const parsed = TacLinkPayload.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      `UPDATE mgm.incidents
       SET tac_case_number = $1, tac_severity = $2
       WHERE incident_id = $3
       RETURNING incident_id, tac_case_number, tac_severity`,
      [parsed.data.tacCaseNumber, parsed.data.tacSeverity, req.params.incidentId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(result.rows[0]);
  }
);
