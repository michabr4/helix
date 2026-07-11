import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { audit } from "../middleware/audit.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../middleware/auth.js";

export const devicesRouter = Router();

/** Roles that see all devices across all properties. */
const PRIVILEGED_ROLES = new Set(["admin", "sdm", "tam", "csm", "engineer", "manager"]);

const CreateDevice = z.object({
  propertyId: z.string().uuid(),
  hostname: z.string().min(1),
  ipAddress: z.string().ip(),
  serialNumber: z.string().min(3),
  status: z.enum(["active", "inactive", "maintenance", "decommissioned", "failed"])
});

// GET / — all devices (privileged) or devices for the user's assigned properties (viewer)
devicesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

  if (PRIVILEGED_ROLES.has(req.auth.role)) {
    const result = await pool.query(
      `SELECT device_id, property_id, hostname, ip_address, serial_number, status
       FROM mgm.devices ORDER BY hostname`
    );
    res.json(result.rows);
  } else {
    // Viewer: devices belonging to user's assigned properties (mgm.user_properties)
    const result = await pool.query(
      `SELECT d.device_id, d.property_id, d.hostname, d.ip_address, d.serial_number, d.status
       FROM mgm.devices d
       JOIN mgm.user_properties up ON up.property_id = d.property_id
       WHERE up.user_id = $1
       ORDER BY d.hostname`,
      [req.auth.userId]
    );
    res.json(result.rows);
  }
});

// GET /:deviceId — single device
devicesRouter.get("/:deviceId", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) { res.status(401).json({ message: "Unauthorized" }); return; }

  const result = await pool.query(
    `SELECT device_id, property_id, hostname, ip_address, serial_number, status,
            dna_device_id, dna_managed, created_at
     FROM mgm.devices WHERE device_id = $1`,
    [req.params.deviceId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  const row = result.rows[0];

  // Viewer: verify they have access to this device's property
  if (!PRIVILEGED_ROLES.has(req.auth.role)) {
    const access = await pool.query(
      "SELECT 1 FROM mgm.user_properties WHERE user_id = $1 AND property_id = $2",
      [req.auth.userId, row.property_id]
    );
    if (access.rowCount === 0) {
      res.status(404).json({ message: "Not found" });
      return;
    }
  }

  res.json(row);
});

devicesRouter.post(
  "/",
  requireAuth,
  requireRoles(["admin", "sdm", "engineer", "manager"]),
  audit("device.create"),
  async (req, res) => {
    const parsed = CreateDevice.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO mgm.devices (property_id, hostname, ip_address, serial_number, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING device_id, property_id, hostname, ip_address, serial_number, status`,
      [
        parsed.data.propertyId,
        parsed.data.hostname,
        parsed.data.ipAddress,
        parsed.data.serialNumber,
        parsed.data.status
      ]
    );
    res.status(201).json(result.rows[0]);
  }
);
