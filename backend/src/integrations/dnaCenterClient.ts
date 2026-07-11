export type DnaDevice = {
  id: string;
  hostname: string;
  managementIpAddress?: string;
  serialNumber?: string;
  reachabilityStatus?: string;
};

/** Token cache TTL: 55 minutes (DNA Center tokens typically expire after 1 hour). */
const TOKEN_TTL_MS = 55 * 60 * 1000;

export class DnaCenterClient {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly host: string,
    private readonly username: string,
    private readonly password: string,
    private readonly port: number
  ) {}

  private async token(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    const response = await fetch(`https://${this.host}:${this.port}/dna/system/api/v1/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`
      }
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn", message: "dna_center_auth_failed",
        host: this.host, status: response.status
      }));
      return "";
    }
    const json = await response.json();
    const t: string = json?.Token ?? "";
    if (t) {
      this.tokenCache = { token: t, expiresAt: Date.now() + TOKEN_TTL_MS };
    }
    return t;
  }

  async listDevices(): Promise<DnaDevice[]> {
    const token = await this.token();
    if (!token) return [];
    const response = await fetch(`https://${this.host}:${this.port}/dna/intent/api/v1/network-device`, {
      headers: { "X-Auth-Token": token }
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn", message: "dna_center_list_devices_failed",
        host: this.host, status: response.status
      }));
      return [];
    }
    const json = await response.json();
    return Array.isArray(json?.response) ? json.response : [];
  }
}
