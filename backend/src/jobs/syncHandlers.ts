import { SalesforceClient } from "../integrations/salesforceClient.js";
import { runDnaSync, runSmartLicensingSync, runTacSync } from "./syncService.js";

export type SyncResult = { processed: number; status?: string; message?: string };

/**
 * Shared sync handler map used by both /api/v1/integrations/sync/:source
 * and /api/v1/admin/sources/:sourceName/test.
 * To add a new source, add one entry here — no other changes needed.
 */
export const syncHandlers: Record<string, () => Promise<SyncResult>> = {
  "dna-center": async () => ({ processed: await runDnaSync() }),
  "tac": async () => ({ processed: await runTacSync() }),
  "smart-licensing": async () => ({ processed: await runSmartLicensingSync() }),
  "salesforce": async () => {
    const result = await SalesforceClient.testConnection();
    return { processed: 0, status: result.ok ? "connected" : "error", message: result.message };
  }
};
