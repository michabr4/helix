/**
 * Adoption routes — read-only views over Cisco product/technology adoption
 * and license utilization, keyed by property.
 *
 * GET /deployments — per-property technology deployment phase/health
 * GET /licenses     — per-property license utilization (used vs purchased)
 * GET /kpis         — aggregate adoption/utilization KPIs
 */
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const adoptionRouter = Router();

const UNDERUTILIZED_THRESHOLD = 0.4;
const NEAR_CAPACITY_THRESHOLD = 0.9;

interface DeploymentRow {
  adoption_id: string;
  property_id: string;
  property_name: string;
  technology_name: string;
  technology_category: string;
  deployment_phase: string | null;
  devices_deployed: number;
  health_score: string | null;
  health_status: string | null;
  updated_at: string;
}

interface LicenseUsageRow {
  usage_id: string;
  property_id: string;
  property_name: string;
  license_id: string;
  product_name: string;
  sku: string;
  quantity_used: string;
  device_count: number;
  user_count: number;
  quantity_purchased: string;
  last_sync: string | null;
}

// GET /deployments — technology adoption per property
adoptionRouter.get("/deployments", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<DeploymentRow>(`
      SELECT
        a.adoption_id, a.property_id, p.name AS property_name,
        t.name AS technology_name, t.category AS technology_category,
        a.deployment_phase, a.devices_deployed,
        a.health_score::text AS health_score, a.health_status,
        a.updated_at
      FROM mgm.property_technology_adoption a
      JOIN mgm.properties p ON p.property_id = a.property_id
      JOIN cisco.technologies t ON t.technology_id = a.technology_id
      ORDER BY p.name ASC, t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /licenses — license utilization per property
adoptionRouter.get("/licenses", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query<LicenseUsageRow>(`
      SELECT
        u.usage_id, u.property_id, p.name AS property_name,
        u.license_id, l.product_name, l.sku,
        u.quantity_used::text AS quantity_used, u.device_count, u.user_count,
        l.quantity_purchased::text AS quantity_purchased, u.last_sync
      FROM mgm.property_license_usage u
      JOIN mgm.properties p ON p.property_id = u.property_id
      JOIN cisco.licenses l ON l.license_id = u.license_id
      ORDER BY p.name ASC, l.product_name ASC
    `);

    const rows = result.rows.map(r => {
      const used = Number(r.quantity_used);
      const purchased = Number(r.quantity_purchased);
      const utilizationPct = purchased > 0 ? Math.round((used / purchased) * 100) / 100 : 0;
      return {
        usage_id: r.usage_id,
        property_id: r.property_id,
        property_name: r.property_name,
        license_id: r.license_id,
        product_name: r.product_name,
        sku: r.sku,
        quantity_used: used,
        device_count: r.device_count,
        user_count: r.user_count,
        quantity_purchased: purchased,
        utilization_pct: utilizationPct,
        last_sync: r.last_sync,
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /kpis — aggregate adoption/utilization KPIs
adoptionRouter.get("/kpis", requireAuth, async (_req, res, next) => {
  try {
    const [deploymentResult, usageResult] = await Promise.all([
      pool.query<{ deployment_phase: string | null; count: string }>(`
        SELECT deployment_phase, COUNT(*)::text AS count
        FROM mgm.property_technology_adoption
        GROUP BY deployment_phase
      `),
      pool.query<{ quantity_used: string; quantity_purchased: string }>(`
        SELECT u.quantity_used::text AS quantity_used, l.quantity_purchased::text AS quantity_purchased
        FROM mgm.property_license_usage u
        JOIN cisco.licenses l ON l.license_id = u.license_id
        WHERE l.quantity_purchased > 0
      `),
    ]);

    const phaseCounts: Record<string, number> = {};
    let totalDeployments = 0;
    for (const row of deploymentResult.rows) {
      const phase = row.deployment_phase ?? "unknown";
      const count = Number(row.count);
      phaseCounts[phase] = count;
      totalDeployments += count;
    }

    const utilizationPcts = usageResult.rows.map(r => {
      const used = Number(r.quantity_used);
      const purchased = Number(r.quantity_purchased);
      return purchased > 0 ? used / purchased : 0;
    });

    const avgUtilization =
      utilizationPcts.length > 0
        ? utilizationPcts.reduce((sum, v) => sum + v, 0) / utilizationPcts.length
        : 0;

    const underutilizedCount = utilizationPcts.filter(v => v < UNDERUTILIZED_THRESHOLD).length;
    const nearCapacityCount = utilizationPcts.filter(v => v >= NEAR_CAPACITY_THRESHOLD).length;

    res.json({
      total_deployments: totalDeployments,
      deployments_by_phase: phaseCounts,
      total_licenses_tracked: utilizationPcts.length,
      avg_license_utilization_pct: Math.round(avgUtilization * 10000) / 100,
      underutilized_license_count: underutilizedCount,
      near_capacity_license_count: nearCapacityCount,
    });
  } catch (err) {
    next(err);
  }
});
