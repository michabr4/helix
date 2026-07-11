import { pool } from "../db.js";
import { env } from "../config.js";
import { DnaCenterClient } from "../integrations/dnaCenterClient.js";
import { TacClient } from "../integrations/tacClient.js";
import { SmartLicensingClient } from "../integrations/smartLicensingClient.js";

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
