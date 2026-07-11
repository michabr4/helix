import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const userPropertiesRouter = Router();

const AssignSchema = z.object({
  propertyIds: z.array(z.string().uuid()).min(1)
});

/** GET /admin/users/:userId/properties — list properties assigned to a user */
userPropertiesRouter.get(
  "/:userId/properties",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  async (req, res) => {
    const result = await pool.query(
      `SELECT p.property_id, p.name, p.property_type
       FROM mgm.properties p
       JOIN mgm.user_properties up ON up.property_id = p.property_id
       WHERE up.user_id = $1
       ORDER BY p.name`,
      [req.params.userId]
    );
    res.json(result.rows);
  }
);

/** POST /admin/users/:userId/properties — assign properties to a user (additive) */
userPropertiesRouter.post(
  "/:userId/properties",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  async (req, res) => {
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request: propertyIds must be a non-empty array of UUIDs" });
      return;
    }
    const { propertyIds } = parsed.data;
    const userId = req.params.userId;

    try {
      await Promise.all(
        propertyIds.map((propertyId) =>
          pool.query(
            `INSERT INTO mgm.user_properties (user_id, property_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, propertyId]
          )
        )
      );
      res.status(201).json({ userId, assigned: propertyIds });
    } catch {
      res.status(500).json({ message: "Failed to assign properties" });
    }
  }
);

/** DELETE /admin/users/:userId/properties/:propertyId — remove one property from a user */
userPropertiesRouter.delete(
  "/:userId/properties/:propertyId",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  async (req, res) => {
    await pool.query(
      "DELETE FROM mgm.user_properties WHERE user_id = $1 AND property_id = $2",
      [req.params.userId, req.params.propertyId]
    );
    res.status(204).send();
  }
);

/** PUT /admin/users/:userId/properties — replace all property assignments for a user */
userPropertiesRouter.put(
  "/:userId/properties",
  requireAuth,
  requireRoles(["admin"]),
  async (req, res) => {
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request: propertyIds must be a non-empty array of UUIDs" });
      return;
    }
    const { propertyIds } = parsed.data;
    const userId = req.params.userId;

    try {
      await pool.query("DELETE FROM mgm.user_properties WHERE user_id = $1", [userId]);
      await Promise.all(
        propertyIds.map((propertyId) =>
          pool.query(
            "INSERT INTO mgm.user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [userId, propertyId]
          )
        )
      );
      res.json({ userId, properties: propertyIds });
    } catch {
      res.status(500).json({ message: "Failed to update property assignments" });
    }
  }
);
