/**
 * Cisco IQ client (Wave 9).
 *
 * Modeled on smartLicensingClient.ts's OAuth2 client-credentials flow —
 * the two waves share the same auth shape per docs/REQUIREMENTS.md's
 * integration pipeline table ("OAuth2/API key... REST: insights,
 * entitlements").
 *
 * IMPORTANT: the real Cisco IQ REST contract (exact paths, response shape)
 * is unconfirmed — https://iq.cisco.com/ui/platform-home/overview is
 * auth-walled and could not be fetched during planning. This client's
 * endpoint path (`/v1/insights`) and response field names are a
 * best-effort assumption based on the documented auth type and purpose
 * ("insights, entitlements"), NOT verified against live Cisco IQ API docs.
 * Validate against real credentials/docs before enabling this source in
 * `mgm.integration_source_configs` (currently seeded `enabled: false`).
 */
export type CiscoIqInsight = {
  smart_account?: string;
  product_family?: string;
  entitled_quantity?: number;
  active_quantity?: number;
  deployment_phase?: string;
  health_score?: number;
  [key: string]: unknown;
};

export class CiscoIqClient {
  constructor(
    private readonly tokenUrl: string,
    private readonly apiUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async accessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) return "";
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn", message: "cisco_iq_auth_failed", status: response.status
      }));
      return "";
    }
    const json = await response.json();
    return json?.access_token ?? "";
  }

  /**
   * Fetch adoption/entitlement insights for a given Smart Account.
   * Returns [] on any auth or fetch failure (never throws) — matches the
   * fail-soft convention of every other sync client in this codebase.
   */
  async getInsights(smartAccount: string): Promise<CiscoIqInsight[]> {
    const token = await this.accessToken();
    if (!token) return [];
    const response = await fetch(`${this.apiUrl}/v1/insights?smartAccount=${encodeURIComponent(smartAccount)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn", message: "cisco_iq_fetch_failed", status: response.status
      }));
      return [];
    }
    const json = await response.json();
    return Array.isArray(json?.insights) ? (json.insights as CiscoIqInsight[]) : [];
  }
}
