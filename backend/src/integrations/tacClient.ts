export type TacCaseSummary = {
  caseNumber: string;
  severity: string;
  status: string;
  lastUpdateAt?: string;
};

export class TacClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly apiSecret: string
  ) {}

  async listCases(): Promise<TacCaseSummary[]> {
    if (!this.apiKey || !this.apiSecret) return [];
    const response = await fetch(`${this.baseUrl}/cases`, {
      headers: {
        "x-api-key": this.apiKey,
        "x-api-secret": this.apiSecret
      }
    });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.cases) ? json.cases : [];
  }
}
