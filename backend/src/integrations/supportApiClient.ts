/**
 * supportApiClient.ts — Cisco Support API integration
 *
 * Covers three endpoints used by the Wave 4 "support-api" integration:
 *  - Coverage / contract status by serial number (sn2info v2)
 *  - End-of-Life / End-of-Sale by product ID (EoX v5)
 *  - Bug details by bug ID (Bug API v2)
 *
 * Authentication: OAuth 2.0 Client Credentials via Cisco's IDP.
 * Token is cached in memory until expiry (same pattern as SmartLicensingClient).
 *
 * Docs: https://developer.cisco.com/docs/support-apis/
 */

const TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token";
const API_BASE  = "https://apix.cisco.com";

/** Minimum seconds remaining before we consider a cached token stale. */
const TOKEN_REFRESH_MARGIN_S = 60;

export interface CoverageRecord {
  sr_no: string;
  is_covered: string;
  coverage_end_date: string;
  service_line_descr: string;
  warranty_end_date: string;
  contract_site_customer_name: string;
  contract_site_address1: string;
  contract_site_city: string;
  contract_site_country: string;
}

export interface EoxRecord {
  EOLProductID: string;
  ProductIDDescription: string;
  EOXExternalAnnouncementDate: { value: string };
  EndOfSaleDate: { value: string };
  EndOfSWMaintenanceReleases: { value: string };
  EndOfSecurityVulSupportDate: { value: string };
  EndOfRoutineFailureAnalysisDate: { value: string };
  EndOfServiceContractRenewal: { value: string };
  LastDateOfSupport: { value: string };
  EndOfSvcAttachDate: { value: string };
  UpdatedTimeStamp: string;
  EOXMigrationDetails: { MigrationOption: string; MigrationProductId: string; MigrationProductName: string };
  LinkToProductBulletinURL: string;
}

export interface BugRecord {
  bug_id: string;
  headline: string;
  description: string;
  severity: string;
  status: string;
  last_modified_date: string;
  product_series: string;
  product: string;
  known_affected_releases: string;
  known_fixed_releases: string;
}

export class SupportApiClient {
  private tokenValue: string | null = null;
  private tokenExpiresAt = 0; // Unix seconds

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string
  ) {}

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenValue && now < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_S) {
      return this.tokenValue;
    }

    if (!this.apiKey || !this.apiSecret) {
      throw new Error("SUPPORT_API credentials not configured");
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.apiKey,
      client_secret: this.apiSecret
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Support API token request failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.tokenValue = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in ?? 3600);
    return this.tokenValue;
  }

  private async apiFetch(path: string): Promise<Response> {
    const token = await this.getToken();
    return fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Coverage / Contract status
  // ---------------------------------------------------------------------------

  /**
   * Returns contract and warranty coverage for a device serial number.
   * Maps to: GET /sn2info/v2/coverage/summary/serial_numbers/{serialNumber}
   */
  async getContractBySerial(serialNumber: string): Promise<CoverageRecord | null> {
    if (!this.apiKey || !this.apiSecret) return null;
    if (!serialNumber?.trim()) return null;

    try {
      const response = await this.apiFetch(
        `/sn2info/v2/coverage/summary/serial_numbers/${encodeURIComponent(serialNumber)}`
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "support_api_coverage_error",
          serial: serialNumber,
          status: response.status
        }));
        return null;
      }
      const data = await response.json() as { serial_numbers?: CoverageRecord[] };
      return data.serial_numbers?.[0] ?? null;
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        message: "support_api_coverage_exception",
        serial: serialNumber,
        error: String(err)
      }));
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // End-of-Life (EoX)
  // ---------------------------------------------------------------------------

  /**
   * Returns EoL/EoS lifecycle dates for a product ID (PID).
   * Maps to: GET /supporttools/eox/rest/5/EOXByProductID/1/{productId}
   */
  async getEoxByPid(productId: string): Promise<EoxRecord | null> {
    if (!this.apiKey || !this.apiSecret) return null;
    if (!productId?.trim()) return null;

    try {
      const response = await this.apiFetch(
        `/supporttools/eox/rest/5/EOXByProductID/1/${encodeURIComponent(productId)}`
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "support_api_eox_error",
          pid: productId,
          status: response.status
        }));
        return null;
      }
      const data = await response.json() as { EOXRecord?: EoxRecord[] };
      return data.EOXRecord?.[0] ?? null;
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        message: "support_api_eox_exception",
        pid: productId,
        error: String(err)
      }));
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Bug details
  // ---------------------------------------------------------------------------

  /**
   * Returns detailed bug information for a Cisco bug ID (e.g. "CSCvz12345").
   * Maps to: GET /bug/v2.0/bugs/bug_ids/{bugId}
   */
  async getBugById(bugId: string): Promise<BugRecord | null> {
    if (!this.apiKey || !this.apiSecret) return null;
    if (!bugId?.trim()) return null;

    try {
      const response = await this.apiFetch(
        `/bug/v2.0/bugs/bug_ids/${encodeURIComponent(bugId)}`
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "support_api_bug_error",
          bugId,
          status: response.status
        }));
        return null;
      }
      const data = await response.json() as { bugs?: BugRecord[] };
      return data.bugs?.[0] ?? null;
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        message: "support_api_bug_exception",
        bugId,
        error: String(err)
      }));
      return null;
    }
  }
}
