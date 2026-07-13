import { pool } from "../db.js";
import { env } from "../config.js";
import { DnaCenterClient } from "../integrations/dnaCenterClient.js";
import { TacClient } from "../integrations/tacClient.js";
import { SmartLicensingClient } from "../integrations/smartLicensingClient.js";
import { CiscoIqClient } from "../integrations/ciscoIqClient.js";

export async function runDnaSync(): Promise<number> {
  const client = new DnaCenterClient(
    env.DNA_CENTER_HOST,
    env.DNA_CENTER_USERNAME,
    env.DNA_CENTER_PASSWORD,
    env.DNA_CENTER_PORT
  );
  const devices = await client.listDevices();

  await Promise.all(
    devices.map((device) =>
      pool.query(
        `INSERT INTO mgm.devices (property_id, hostname, ip_address, serial_number, status, dna_device_id, dna_managed)
         VALUES (
          (SELECT property_id FROM mgm.properties ORDER BY created_at LIMIT 1),
          $1, $2, COALESCE($3, 'unknown-serial'), 'active', $4, TRUE
         )
         ON CONFLICT DO NOTHING`,
        [device.hostname, device.managementIpAddress ?? null, device.serialNumber ?? null, device.id]
      )
    )
  );
  return devices.length;
}

export async function runTacSync(): Promise<number> {
  const client = new TacClient(env.TAC_BASE_URL, env.TAC_API_KEY, env.TAC_API_SECRET);
  const cases = await client.listCases();
  for (const tacCase of cases) {
    await pool.query(
      `INSERT INTO cisco.tac_cases (case_number, severity, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (case_number) DO UPDATE
       SET severity = EXCLUDED.severity, status = EXCLUDED.status`,
      [tacCase.caseNumber, tacCase.severity, tacCase.status]
    );
  }
  return cases.length;
}

export async function runSmartLicensingSync(): Promise<number> {
  const client = new SmartLicensingClient(
    env.SMART_LICENSING_TOKEN_URL,
    env.SMART_LICENSING_API_URL,
    env.SMART_LICENSING_CLIENT_ID,
    env.SMART_LICENSING_CLIENT_SECRET
  );
  const entitlements = await client.getEntitlements();
  if (entitlements.length === 0) return 0;

  await Promise.all(
    entitlements.map((lic) =>
      pool.query(
        `INSERT INTO cisco.smart_licenses
           (license_name, virtual_account, quantity, in_use, balance, status, expires_at, raw, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (license_name, virtual_account)
         DO UPDATE SET
           quantity      = EXCLUDED.quantity,
           in_use        = EXCLUDED.in_use,
           balance       = EXCLUDED.balance,
           status        = EXCLUDED.status,
           expires_at    = EXCLUDED.expires_at,
           raw           = EXCLUDED.raw,
           synced_at     = NOW()`,
        [
          lic.license,
          lic.virtual_account ?? null,
          lic.quantity ?? 0,
          lic.in_use ?? 0,
          lic.balance ?? 0,
          lic.status ?? null,
          lic.expiry_date ?? null,
          JSON.stringify(lic)
        ]
      )
    )
  );
  return entitlements.length;
}

/**
 * Cisco IQ (Wave 9) adoption/entitlement sync.
 *
 * Only processes cisco.licenses rows that already have BOTH smart_account
 * and property_id set (see migration 013_cisco_licenses_property_link.sql)
 * — there is no other way to know which property a Cisco IQ insight belongs
 * to, so licenses without a resolved property_id are skipped rather than
 * guessed at.
 */
export async function runCiscoIqSync(): Promise<number> {
  const client = new CiscoIqClient(
    env.CISCO_IQ_TOKEN_URL,
    env.CISCO_IQ_API_URL,
    env.CISCO_IQ_CLIENT_ID,
    env.CISCO_IQ_CLIENT_SECRET
  );

  const licenseRows = await pool.query<{ license_id: string; smart_account: string; property_id: string }>(
    `SELECT license_id, smart_account, property_id
     FROM cisco.licenses
     WHERE smart_account IS NOT NULL AND property_id IS NOT NULL`
  );

  let processed = 0;

  for (const row of licenseRows.rows) {
    const insights = await client.getInsights(row.smart_account);

    for (const insight of insights) {
      if (!insight.product_family) continue;

      const techResult = await pool.query<{ technology_id: string }>(
        `SELECT technology_id FROM cisco.technologies WHERE name = $1 LIMIT 1`,
        [insight.product_family]
      );
      let technologyId = techResult.rows[0]?.technology_id;
      if (!technologyId) {
        const inserted = await pool.query<{ technology_id: string }>(
          `INSERT INTO cisco.technologies (name, category)
           VALUES ($1, 'Network Infrastructure')
           RETURNING technology_id`,
          [insight.product_family]
        );
        technologyId = inserted.rows[0].technology_id;
      }

      await pool.query(
        `INSERT INTO mgm.property_technology_adoption
           (property_id, technology_id, deployment_phase, devices_deployed, health_score)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (property_id, technology_id) DO UPDATE SET
           deployment_phase = EXCLUDED.deployment_phase,
           devices_deployed = EXCLUDED.devices_deployed,
           health_score     = EXCLUDED.health_score,
           updated_at       = NOW()
         RETURNING adoption_id`,
        [
          row.property_id,
          technologyId,
          insight.deployment_phase ?? null,
          insight.active_quantity ?? 0,
          insight.health_score ?? null
        ]
      ).then(result => pool.query(
        `INSERT INTO mgm.adoption_history (adoption_id, deployment_phase, health_score, devices_deployed)
         VALUES ($1, $2, $3, $4)`,
        [result.rows[0].adoption_id, insight.deployment_phase ?? null, insight.health_score ?? null, insight.active_quantity ?? 0]
      ));

      await pool.query(
        `INSERT INTO mgm.property_license_usage
           (property_id, license_id, quantity_used, device_count, last_sync, sync_source)
         VALUES ($1, $2, $3, $4, NOW(), 'cisco-iq')
         ON CONFLICT (property_id, license_id) DO UPDATE SET
           quantity_used = EXCLUDED.quantity_used,
           device_count  = EXCLUDED.device_count,
           last_sync     = NOW(),
           sync_source   = 'cisco-iq',
           updated_at    = NOW()`,
        [row.property_id, row.license_id, insight.entitled_quantity ?? 0, insight.active_quantity ?? 0]
      );

      processed += 1;
    }
  }

  return processed;
}
