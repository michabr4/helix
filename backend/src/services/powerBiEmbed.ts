import { env } from "../config.js";

const POWER_BI_SCOPE = "https://analysis.windows.net/powerbi/api/.default";

export type PowerBiEmbedPayload = {
  enabled: true;
  embedUrl: string;
  embedToken: string;
  reportId: string;
  reportName: string;
  tokenExpiry: string;
  workspaceId: string;
};

export function isPowerBiEmbedConfigured(): boolean {
  return (
    env.POWERBI_ENABLED &&
    env.POWERBI_TENANT_ID.length > 0 &&
    env.POWERBI_CLIENT_ID.length > 0 &&
    env.POWERBI_CLIENT_SECRET.length > 0 &&
    env.POWERBI_WORKSPACE_ID.length > 0 &&
    env.POWERBI_REPORT_ID.length > 0
  );
}

async function getAzureAppToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.POWERBI_CLIENT_ID,
    client_secret: env.POWERBI_CLIENT_SECRET,
    scope: POWER_BI_SCOPE,
    grant_type: "client_credentials"
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(env.POWERBI_TENANT_ID)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure AD token request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Azure AD token response missing access_token");
  }
  return json.access_token;
}

type PbiReport = { id: string; name: string; embedUrl: string };
type PbiGenerateToken = { token: string; expiration: string };

/**
 * Creates a short-lived embed token and returns URLs required by powerbi-client.
 * Requires a service principal (Azure AD app) enabled for Power BI and granted
 * access to the workspace (Admin or Member).
 */
export async function createReportEmbedContext(): Promise<PowerBiEmbedPayload> {
  const aad = await getAzureAppToken();
  const ws = env.POWERBI_WORKSPACE_ID;
  const rep = env.POWERBI_REPORT_ID;
  const reportUrl = `https://api.powerbi.com/v1.0/myorg/groups/${encodeURIComponent(ws)}/reports/${encodeURIComponent(rep)}`;

  const reportRes = await fetch(reportUrl, {
    headers: { Authorization: `Bearer ${aad}` }
  });
  if (!reportRes.ok) {
    const text = await reportRes.text();
    throw new Error(`Power BI GetReport failed (${reportRes.status}): ${text.slice(0, 200)}`);
  }
  const report = (await reportRes.json()) as PbiReport;

  const tokenRes = await fetch(`${reportUrl}/GenerateToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aad}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessLevel: "View",
      allowSaveAs: false
    })
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Power BI GenerateToken failed (${tokenRes.status}): ${text.slice(0, 200)}`);
  }
  const tokenJson = (await tokenRes.json()) as PbiGenerateToken;

  return {
    enabled: true,
    embedUrl: report.embedUrl,
    embedToken: tokenJson.token,
    reportId: report.id,
    reportName: report.name,
    tokenExpiry: tokenJson.expiration,
    workspaceId: ws
  };
}
