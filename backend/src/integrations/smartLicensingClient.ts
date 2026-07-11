export type SmartLicense = {
  license: string;
  virtual_account?: string;
  quantity?: number;
  in_use?: number;
  balance?: number;
  status?: string;
  /** ISO 8601 string, e.g. "2026-12-31T00:00:00Z" */
  expiry_date?: string;
  [key: string]: unknown;
};

export class SmartLicensingClient {
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
        level: "warn", message: "smart_licensing_auth_failed", status: response.status
      }));
      return "";
    }
    const json = await response.json();
    return json?.access_token ?? "";
  }

  async getEntitlements(): Promise<SmartLicense[]> {
    const token = await this.accessToken();
    if (!token) return [];
    const response = await fetch(`${this.apiUrl}/v1/licenses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn", message: "smart_licensing_fetch_failed", status: response.status
      }));
      return [];
    }
    const json = await response.json();
    return Array.isArray(json?.licenses) ? (json.licenses as SmartLicense[]) : [];
  }
}
