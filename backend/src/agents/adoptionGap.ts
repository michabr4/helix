/**
 * Agent 13 — Adoption & Utilization Gap Agent (SDM/PM role)
 *
 * Observes: per-property Cisco technology deployment phases
 *           (mgm.property_technology_adoption) and license consumption
 *           (mgm.property_license_usage joined to cisco.licenses) to find
 *           stalled deployments and license utilization gaps.
 * Reasons:  flags deployments stuck in an early phase (planning/design/pilot)
 *           past a staleness threshold, and licenses that are significantly
 *           under- or over-utilized relative to what was purchased.
 * Acts:     read-only — no destructive/write actions. Any human-facing
 *           notification recommended by the LLM is queued for approval via
 *           the base agent's `requestApproval` flow.
 * Reports:  adoption-gap summary with stalled deployments and utilization
 *           outliers, keyed by property so an SDM can prioritize follow-up.
 *
 * No external API dependencies — reads only from
 * mgm.property_technology_adoption, mgm.property_license_usage,
 * cisco.licenses, cisco.technologies, and mgm.properties, all already
 * present in this database. Real license/usage telemetry is populated by
 * the Smart Licensing and (once validated) Cisco IQ sync jobs.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const STALLED_PHASE_DAYS = 45;
const UNDERUTILIZED_THRESHOLD = 0.4; // <40% of purchased quantity consumed
const NEAR_CAPACITY_THRESHOLD = 0.9; // >=90% of purchased quantity consumed
const EARLY_PHASES = ["planning", "design", "pilot"];

interface StalledDeploymentRow {
  adoption_id: string;
  property_id: string;
  property_name: string;
  technology_name: string;
  deployment_phase: string;
  devices_deployed: number;
  updated_at: string;
  days_in_phase: string;
}

interface LicenseUtilizationRow {
  usage_id: string;
  property_id: string;
  property_name: string;
  license_id: string;
  product_name: string;
  sku: string;
  quantity_used: string;
  quantity_purchased: string;
}

export class AdoptionGapAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-13-adoption-utilization-gap",
      name: "Adoption & Utilization Gap Agent",
      role: "SDM",
      systemPrompt: `You are the Adoption & Utilization Gap agent for a Cisco service delivery team.
Your goal is to identify properties where Cisco technology adoption has stalled in an
early deployment phase, or where purchased license capacity is significantly under- or
over-utilized. Under-utilization signals adoption risk and a need for enablement;
near-capacity utilization signals an expansion opportunity. Be factual — cite property
names, technologies/products, and concrete numbers.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [stalledResult, usageResult] = await Promise.all([
      pool.query<StalledDeploymentRow>(
        `SELECT
           a.adoption_id,
           a.property_id,
           p.name AS property_name,
           t.name AS technology_name,
           a.deployment_phase,
           a.devices_deployed,
           a.updated_at,
           EXTRACT(DAY FROM NOW() - a.updated_at)::text AS days_in_phase
         FROM mgm.property_technology_adoption a
         JOIN mgm.properties p ON p.property_id = a.property_id
         JOIN cisco.technologies t ON t.technology_id = a.technology_id
         WHERE a.deployment_phase = ANY($1)
           AND a.updated_at <= NOW() - INTERVAL '${STALLED_PHASE_DAYS} days'
         ORDER BY a.updated_at ASC`,
        [EARLY_PHASES]
      ),
      pool.query<LicenseUtilizationRow>(
        `SELECT
           u.usage_id,
           u.property_id,
           p.name AS property_name,
           u.license_id,
           l.product_name,
           l.sku,
           u.quantity_used::text AS quantity_used,
           l.quantity_purchased::text AS quantity_purchased
         FROM mgm.property_license_usage u
         JOIN mgm.properties p ON p.property_id = u.property_id
         JOIN cisco.licenses l ON l.license_id = u.license_id
         WHERE l.quantity_purchased > 0`
      ),
    ]);

    const stalledDeployments = stalledResult.rows.map(r => ({
      adoption_id: r.adoption_id,
      property_id: r.property_id,
      property_name: r.property_name,
      technology_name: r.technology_name,
      deployment_phase: r.deployment_phase,
      devices_deployed: r.devices_deployed,
      days_in_phase: Number(r.days_in_phase),
    }));

    const utilization = usageResult.rows.map(r => {
      const used = Number(r.quantity_used);
      const purchased = Number(r.quantity_purchased);
      const utilizationPct = purchased > 0 ? used / purchased : 0;
      return {
        usage_id: r.usage_id,
        property_id: r.property_id,
        property_name: r.property_name,
        product_name: r.product_name,
        sku: r.sku,
        quantity_used: used,
        quantity_purchased: purchased,
        utilization_pct: Math.round(utilizationPct * 100) / 100,
      };
    });

    const underutilized = utilization.filter(u => u.utilization_pct < UNDERUTILIZED_THRESHOLD);
    const nearCapacity = utilization.filter(u => u.utilization_pct >= NEAR_CAPACITY_THRESHOLD);

    return {
      data: {
        stalled_phase_threshold_days: STALLED_PHASE_DAYS,
        stalled_deployments: stalledDeployments,
        license_utilization: utilization,
        underutilized_licenses: underutilized,
        near_capacity_licenses: nearCapacity,
      },
      summary:
        `${stalledDeployments.length} deployment(s) stalled in an early phase for ` +
        `>=${STALLED_PHASE_DAYS} days. ${underutilized.length} license(s) under ` +
        `${Math.round(UNDERUTILIZED_THRESHOLD * 100)}% utilization (adoption risk), ` +
        `${nearCapacity.length} license(s) at/above ${Math.round(NEAR_CAPACITY_THRESHOLD * 100)}% ` +
        `utilization (expansion opportunity).`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes. Notification-style recommendations
    // from reason() are routed through requestApproval() by the base run() loop.
    return [];
  }
}

export const adoptionGapAgent = new AdoptionGapAgent();
