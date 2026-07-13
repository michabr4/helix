/**
 * Agent 5 — Renewal Risk Early Warning Agent (SDM role)
 *
 * Observes: active devices (mgm.devices) with a support contract expiring
 *           or already expired, and Cisco licenses (cisco.licenses) with an
 *           expiry date approaching or already past, cross-referenced with
 *           license utilization (mgm.property_license_usage) to prioritize
 *           renewals that are actively in use.
 * Reasons:  classifies each expiring item into a renewal-risk tier
 *           (critical/warning) based on days remaining, and flags
 *           already-expired items separately since those represent active
 *           coverage gaps, not future risk.
 * Acts:     read-only — no destructive/write actions. Any human-facing
 *           notification recommended by the LLM is queued for approval via
 *           the base agent's `requestApproval` flow.
 * Reports:  renewal-risk summary with critical/warning/expired counts and
 *           the underlying items, so an SDM can prioritize renewal outreach.
 *
 * No external API dependencies — reads only from mgm.devices,
 * cisco.licenses, mgm.properties, and mgm.property_license_usage, all
 * already present in this database.
 */
import { pool } from "../db.js";
import { HelixAgent, type ActionSpec, type ObserveResult } from "./base.js";

const WARNING_WINDOW_DAYS = 90;
const CRITICAL_WINDOW_DAYS = 30;

interface ExpiringDeviceRow {
  device_id: string;
  hostname: string;
  property_id: string;
  property_name: string;
  status: string;
  contract_number: string | null;
  contract_expiry: string | null;
  days_to_expiry: string;
}

interface ExpiringLicenseRow {
  license_id: string;
  product_name: string;
  sku: string;
  expiry_date: string;
  quantity_purchased: number;
  quantity_consumed: number;
  days_to_expiry: string;
}

function classify(daysToExpiry: number): "expired" | "critical" | "warning" | null {
  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= CRITICAL_WINDOW_DAYS) return "critical";
  if (daysToExpiry <= WARNING_WINDOW_DAYS) return "warning";
  return null;
}

export class RenewalRiskAgent extends HelixAgent {
  constructor() {
    super({
      agentId: "agent-05-renewal-risk",
      name: "Renewal Risk Early Warning Agent",
      role: "SDM",
      systemPrompt: `You are the Renewal Risk Early Warning agent for a Cisco service delivery team.
Your goal is to give SDMs early visibility into device support contracts and Cisco
licenses that are expiring soon or have already lapsed, so renewals can be initiated
before coverage gaps or compliance issues occur. Prioritize by urgency (already expired,
then critical <=30 days, then warning <=90 days) and by whether the item is actively in
use. Be factual — cite device/license identifiers and exact day counts.`,
    });
  }

  async observe(_input: Record<string, unknown>): Promise<ObserveResult> {
    const [deviceResult, licenseResult] = await Promise.all([
      pool.query<ExpiringDeviceRow>(
        `SELECT
           d.device_id, d.hostname, d.property_id, p.name AS property_name,
           d.status, d.contract_number, d.contract_expiry::text AS contract_expiry,
           (d.contract_expiry - CURRENT_DATE)::text AS days_to_expiry
         FROM mgm.devices d
         JOIN mgm.properties p ON p.property_id = d.property_id
         WHERE d.status != 'decommissioned'
           AND d.contract_expiry IS NOT NULL
           AND d.contract_expiry <= CURRENT_DATE + INTERVAL '${WARNING_WINDOW_DAYS} days'
         ORDER BY d.contract_expiry ASC`
      ),
      pool.query<ExpiringLicenseRow>(
        `SELECT
           license_id, product_name, sku, expiry_date::text AS expiry_date,
           quantity_purchased, quantity_consumed,
           (expiry_date - CURRENT_DATE)::text AS days_to_expiry
         FROM cisco.licenses
         WHERE expiry_date IS NOT NULL
           AND expiry_date <= CURRENT_DATE + INTERVAL '${WARNING_WINDOW_DAYS} days'
         ORDER BY expiry_date ASC`
      ),
    ]);

    const devices = deviceResult.rows
      .map(r => {
        const days = Number(r.days_to_expiry);
        const tier = classify(days);
        if (!tier) return null;
        return {
          device_id: r.device_id,
          hostname: r.hostname,
          property_id: r.property_id,
          property_name: r.property_name,
          status: r.status,
          contract_number: r.contract_number,
          contract_expiry: r.contract_expiry,
          days_to_expiry: days,
          risk_tier: tier,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const licenses = licenseResult.rows
      .map(r => {
        const days = Number(r.days_to_expiry);
        const tier = classify(days);
        if (!tier) return null;
        const utilizationPct =
          r.quantity_purchased > 0 ? Math.round((r.quantity_consumed / r.quantity_purchased) * 100) / 100 : 0;
        return {
          license_id: r.license_id,
          product_name: r.product_name,
          sku: r.sku,
          expiry_date: r.expiry_date,
          quantity_purchased: r.quantity_purchased,
          quantity_consumed: r.quantity_consumed,
          utilization_pct: utilizationPct,
          days_to_expiry: days,
          risk_tier: tier,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const expiredDevices = devices.filter(d => d.risk_tier === "expired");
    const criticalDevices = devices.filter(d => d.risk_tier === "critical");
    const warningDevices = devices.filter(d => d.risk_tier === "warning");

    const expiredLicenses = licenses.filter(l => l.risk_tier === "expired");
    const criticalLicenses = licenses.filter(l => l.risk_tier === "critical");
    const warningLicenses = licenses.filter(l => l.risk_tier === "warning");

    return {
      data: {
        warning_window_days: WARNING_WINDOW_DAYS,
        critical_window_days: CRITICAL_WINDOW_DAYS,
        expiring_devices: devices,
        expiring_licenses: licenses,
        expired_device_count: expiredDevices.length,
        critical_device_count: criticalDevices.length,
        warning_device_count: warningDevices.length,
        expired_license_count: expiredLicenses.length,
        critical_license_count: criticalLicenses.length,
        warning_license_count: warningLicenses.length,
      },
      summary:
        `Devices: ${expiredDevices.length} expired, ${criticalDevices.length} critical (<=${CRITICAL_WINDOW_DAYS}d), ` +
        `${warningDevices.length} warning (<=${WARNING_WINDOW_DAYS}d). ` +
        `Licenses: ${expiredLicenses.length} expired, ${criticalLicenses.length} critical, ${warningLicenses.length} warning.`,
    };
  }

  async act(_actions: ActionSpec[]): Promise<string[]> {
    // Read-only agent — no direct writes. Notification-style recommendations
    // from reason() are routed through requestApproval() by the base run() loop.
    return [];
  }
}

export const renewalRiskAgent = new RenewalRiskAgent();
