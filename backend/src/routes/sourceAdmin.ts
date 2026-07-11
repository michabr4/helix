import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { syncHandlers } from "../jobs/syncHandlers.js";

const VALID_SOURCES = [
  "dna-center",
  "tac",
  "smart-licensing",
  "webex",
  "support-api",
  "teams",
  "thousandeyes",
  "umbrella",
  "stealthwatch",
  "dwdm",
  "cisco-iq",
  "cspc",
  "ise",
  "cisco-spaces",
  "secure-access",
  "psirt-openvuln",
  "field-notices",
  "fmc",
  "salesforce"
] as const;

const SourceUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
  authType: z.string().min(1).optional(),
  schedule: z.string().min(1).optional(),
  credentialsRef: z.string().min(1).optional(),
  notes: z.string().max(1000).optional()
});

type SourceName = (typeof VALID_SOURCES)[number];

export const sourceAdminRouter = Router();

/**
 * Creates and seeds the integration_source_configs table if it doesn't exist.
 * Called once at server startup from bootstrap() — not on every request.
 */
export async function ensureIntegrationSourcesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mgm.integration_source_configs (
      source_name TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT false,
      base_url TEXT,
      auth_type TEXT,
      schedule TEXT,
      credentials_ref TEXT,
      notes TEXT,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO mgm.integration_source_configs (source_name, enabled, auth_type, schedule, notes)
    VALUES
      ('dna-center', true, 'basic-token', '*/30 * * * *', 'Wave 1'),
      ('tac', true, 'api-key-secret', '*/15 * * * *', 'Wave 2'),
      ('smart-licensing', true, 'oauth2-client-credentials', '0 * * * *', 'Wave 3'),
      ('webex', false, 'bot-token-oauth', 'manual', 'Wave 4'),
      ('support-api', false, 'api-key-secret', '0 2 * * *', 'Wave 4 — Contract/EoX/Bug'),
      ('teams', false, 'oauth2-bot', 'manual', 'Microsoft Teams'),
      ('thousandeyes', false, 'api-token', '*/15 * * * *', 'Wave 5'),
      ('umbrella', false, 'api-key-oauth', '0 * * * *', 'Wave 6'),
      ('stealthwatch', false, 'api-basic-or-token', '*/30 * * * *', 'Wave 7 — SNA'),
      ('dwdm', false, 'collector-or-ems', '0 * * * *', 'Wave 8 — optical / EMS'),
      ('cisco-iq', false, 'oauth2-or-api-key', '0 4 * * *', 'Wave 9'),
      ('cspc', false, 'collector-registration', '0 1 * * *', 'Wave 10'),
      ('ise', false, 'ers-pxgrid', '*/30 * * * *', 'Wave 11 — ISE + ISE as Code (ERS/OpenAPI/pxGrid; policy/config automation APIs)'),
      ('cisco-spaces', false, 'oauth2-api-key', '0 * * * *', 'Wave 12'),
      ('secure-access', false, 'oauth2-client-credentials', '*/15 * * * *', 'Wave 13 — SSE / ZTNA'),
      ('psirt-openvuln', false, 'oauth2-client-credentials', '0 3 * * *', 'Wave 14 — PSIRT / OpenVuln advisories & CVEs'),
      ('field-notices', false, 'api-key-oauth', '0 4 * * *', 'Wave 15 — Cisco Field Notices (PID/serial/software match)'),
      ('fmc', true, 'api-token-or-basic', '*/30 * * * *', 'Wave 16 — Firepower Management Center (FMC REST · FTD inventory & policies)'),
      ('salesforce', false, 'oauth2-password', '*/15 * * * *', 'Wave 17 — Salesforce CRM (Cases, Accounts, Contacts, Opportunities, Entitlements, Service Contracts)')
    ON CONFLICT (source_name) DO NOTHING
  `);
}

sourceAdminRouter.get(
  "/sources",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT source_name AS "sourceName", enabled, base_url AS "baseUrl", auth_type AS "authType",
                schedule, credentials_ref AS "credentialsRef", notes, updated_at AS "updatedAt"
         FROM mgm.integration_source_configs
         ORDER BY source_name`
      );
      res.json(result.rows);
    } catch {
      res.status(500).json({ message: "Failed to retrieve source configurations" });
    }
  }
);

sourceAdminRouter.put(
  "/sources/:sourceName",
  requireAuth,
  requireRoles(["admin", "sdm", "manager"]),
  async (req, res) => {
    const sourceName = req.params.sourceName as SourceName;
    if (!VALID_SOURCES.includes(sourceName)) {
      res.status(400).json({ message: "Unsupported source" });
      return;
    }

    const parsed = SourceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }

    try {
      const body = parsed.data;
      const result = await pool.query(
        `UPDATE mgm.integration_source_configs
         SET enabled = COALESCE($1, enabled),
             base_url = COALESCE($2, base_url),
             auth_type = COALESCE($3, auth_type),
             schedule = COALESCE($4, schedule),
             credentials_ref = COALESCE($5, credentials_ref),
             notes = COALESCE($6, notes),
             updated_at = NOW()
         WHERE source_name = $7
         RETURNING source_name AS "sourceName", enabled, base_url AS "baseUrl", auth_type AS "authType",
                   schedule, credentials_ref AS "credentialsRef", notes, updated_at AS "updatedAt"`,
        [
          body.enabled,
          body.baseUrl,
          body.authType,
          body.schedule,
          body.credentialsRef,
          body.notes,
          sourceName
        ]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: "Source not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch {
      res.status(500).json({ message: "Failed to update source configuration" });
    }
  }
);

sourceAdminRouter.post(
  "/sources/:sourceName/test",
  requireAuth,
  requireRoles(["admin", "sdm", "tam", "manager"]),
  async (req, res) => {
    const sourceName = req.params.sourceName as SourceName;
    const handler = syncHandlers[sourceName];

    try {
      if (handler) {
        const result = await handler();
        res.json({ sourceName, ...result, status: result.status ?? "ok" });
        return;
      }
      // Source exists but has no active sync job wired yet
      res.json({ sourceName, processed: 0, status: "configured", message: "No active sync job wired yet." });
    } catch {
      res.status(502).json({ message: `Connection test failed for source: ${sourceName}` });
    }
  }
);
