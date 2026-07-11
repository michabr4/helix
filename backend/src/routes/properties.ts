import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { audit } from "../middleware/audit.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const propertiesRouter = Router();

const CreateProperty = z.object({
  name: z.string().min(1),
  propertyType: z.enum(["hotel", "casino", "resort", "venue"])
});

propertiesRouter.get("/", requireAuth, async (_req, res) => {
  const result = await pool.query("SELECT property_id, name, property_type FROM mgm.properties ORDER BY name");
  res.json(result.rows);
});

propertiesRouter.get("/:propertyId", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT property_id, name, property_type, created_at FROM mgm.properties WHERE property_id = $1",
    [req.params.propertyId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(result.rows[0]);
});

propertiesRouter.post(
  "/",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  audit("property.create"),
  async (req, res) => {
    const parsed = CreateProperty.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const result = await pool.query(
      "INSERT INTO mgm.properties (name, property_type) VALUES ($1, $2) RETURNING property_id, name, property_type",
      [parsed.data.name, parsed.data.propertyType]
    );
    res.status(201).json(result.rows[0]);
  }
);
