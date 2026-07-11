import { env } from "../config.js";

type SfTokenResponse = {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
  id: string;
};

type SfQueryResult<T> = {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
};

type SfSObject = Record<string, unknown> & { Id: string; attributes?: { type: string; url: string } };

let tokenCache: { accessToken: string; instanceUrl: string; expiresAt: number } | null = null;

function isSalesforceConfigured(): boolean {
  return (
    env.SALESFORCE_ENABLED &&
    env.SALESFORCE_LOGIN_URL.length > 0 &&
    env.SALESFORCE_CLIENT_ID.length > 0 &&
    env.SALESFORCE_CLIENT_SECRET.length > 0 &&
    env.SALESFORCE_USERNAME.length > 0 &&
    env.SALESFORCE_PASSWORD.length > 0
  );
}

async function authenticate(): Promise<{ accessToken: string; instanceUrl: string }> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return { accessToken: tokenCache.accessToken, instanceUrl: tokenCache.instanceUrl };
  }

  // Prefer client_credentials (no deprecated ROPC) when SALESFORCE_OAUTH_FLOW=client_credentials.
  // Requires the Connected App to have "Client Credentials Flow" enabled with a "Run As" user.
  // See: https://help.salesforce.com/s/articleView?id=sf.connected_app_client_credentials_setup.htm
  const body =
    env.SALESFORCE_OAUTH_FLOW === "client_credentials"
      ? new URLSearchParams({
          grant_type: "client_credentials",
          client_id: env.SALESFORCE_CLIENT_ID,
          client_secret: env.SALESFORCE_CLIENT_SECRET
        })
      : new URLSearchParams({
          grant_type: "password",
          client_id: env.SALESFORCE_CLIENT_ID,
          client_secret: env.SALESFORCE_CLIENT_SECRET,
          username: env.SALESFORCE_USERNAME,
          password: env.SALESFORCE_PASSWORD + env.SALESFORCE_SECURITY_TOKEN
        });

  const res = await fetch(`${env.SALESFORCE_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as SfTokenResponse;
  tokenCache = {
    accessToken: json.access_token,
    instanceUrl: json.instance_url,
    expiresAt: Date.now() + 110 * 60 * 1000
  };
  return { accessToken: json.access_token, instanceUrl: json.instance_url };
}

function invalidateToken(): void {
  tokenCache = null;
}

async function sfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken, instanceUrl } = await authenticate();
  const url = path.startsWith("http") ? path : `${instanceUrl}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined)
    }
  });

  if (res.status === 401) {
    invalidateToken();
    throw new Error("Salesforce token expired — retry authentication");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce API error (${res.status}): ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

const API_VERSION = env.SALESFORCE_API_VERSION || "v59.0";

export class SalesforceClient {
  static isConfigured = isSalesforceConfigured;

  static async query<T extends SfSObject>(soql: string): Promise<SfQueryResult<T>> {
    return sfFetch<SfQueryResult<T>>(
      `/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`
    );
  }

  static async getRecord<T extends SfSObject>(sObjectType: string, id: string, fields?: string[]): Promise<T> {
    const fieldParam = fields?.length ? `?fields=${fields.join(",")}` : "";
    return sfFetch<T>(`/services/data/${API_VERSION}/sobjects/${sObjectType}/${id}${fieldParam}`);
  }

  static async createRecord(sObjectType: string, data: Record<string, unknown>): Promise<{ id: string; success: boolean }> {
    return sfFetch<{ id: string; success: boolean }>(`/services/data/${API_VERSION}/sobjects/${sObjectType}`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  static async updateRecord(sObjectType: string, id: string, data: Record<string, unknown>): Promise<void> {
    // PATCH returns 204 No Content on success — sfFetch would try to parse an empty body, so
    // we need a raw fetch here. We still go through authenticate() and honour 401 by invalidating
    // the token cache before throwing, matching sfFetch behaviour.
    const { accessToken, instanceUrl } = await authenticate();
    const res = await fetch(`${instanceUrl}/services/data/${API_VERSION}/sobjects/${sObjectType}/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (res.status === 401) {
      invalidateToken();
      throw new Error("Salesforce token expired — retry authentication");
    }
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(`Salesforce update failed (${res.status}): ${text.slice(0, 300)}`);
    }
  }

  static async getCases(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, CaseNumber, Subject, Status, Priority, Type, Origin, ContactId, AccountId, ` +
      `Account.Name, Contact.Name, OwnerId, Owner.Name, CreatedDate, ClosedDate, Description ` +
      `FROM Case ORDER BY CreatedDate DESC LIMIT ${limit}`
    );
  }

  static async getAccounts(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Name, Type, Industry, Phone, Website, BillingCity, BillingState, ` +
      `OwnerId, Owner.Name, AnnualRevenue, NumberOfEmployees, Description, CreatedDate ` +
      `FROM Account WHERE Type != null ORDER BY Name LIMIT ${limit}`
    );
  }

  static async getContacts(accountId?: string, limit = 100): Promise<SfQueryResult<SfSObject>> {
    const sfIdPattern = /^[a-zA-Z0-9]{15,18}$/;
    if (accountId && !sfIdPattern.test(accountId)) {
      throw new Error("Invalid Salesforce AccountId format");
    }
    const where = accountId ? ` WHERE AccountId = '${accountId}'` : "";
    return this.query(
      `SELECT Id, FirstName, LastName, Email, Phone, Title, Department, AccountId, ` +
      `Account.Name, OwnerId, MailingCity, MailingState, CreatedDate ` +
      `FROM Contact${where} ORDER BY LastName LIMIT ${limit}`
    );
  }

  static async getOpportunities(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Name, StageName, Amount, CloseDate, Probability, Type, LeadSource, ` +
      `AccountId, Account.Name, OwnerId, Owner.Name, NextStep, Description, FiscalYear, ` +
      `FiscalQuarter, CreatedDate ` +
      `FROM Opportunity ORDER BY CloseDate DESC LIMIT ${limit}`
    );
  }

  static async getEntitlements(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Name, AccountId, Account.Name, StartDate, EndDate, Status, Type, ` +
      `ServiceContractId, RemainingCases, ContractLineItemId, CreatedDate ` +
      `FROM Entitlement ORDER BY EndDate DESC LIMIT ${limit}`
    );
  }

  static async getServiceContracts(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Name, AccountId, Account.Name, StartDate, EndDate, Status, ` +
      `Term, ApprovalStatus, ContactId, Contact.Name, Description, CreatedDate ` +
      `FROM ServiceContract ORDER BY EndDate DESC LIMIT ${limit}`
    );
  }

  static async getTasks(limit = 100): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Subject, Status, Priority, ActivityDate, WhoId, WhatId, OwnerId, ` +
      `Owner.Name, Description, Type, CreatedDate ` +
      `FROM Task WHERE IsClosed = false ORDER BY ActivityDate ASC LIMIT ${limit}`
    );
  }

  static async getKnowledgeArticles(limit = 50): Promise<SfQueryResult<SfSObject>> {
    return this.query(
      `SELECT Id, Title, ArticleNumber, PublishStatus, VersionNumber, ` +
      `CreatedDate, LastModifiedDate ` +
      `FROM Knowledge__kav WHERE PublishStatus = 'Online' ORDER BY LastModifiedDate DESC LIMIT ${limit}`
    );
  }

  static async testConnection(): Promise<{ ok: boolean; instanceUrl?: string; orgId?: string; message?: string }> {
    if (!isSalesforceConfigured()) {
      return { ok: false, message: "Salesforce is not configured. Set SALESFORCE_* environment variables." };
    }
    try {
      const { accessToken, instanceUrl } = await authenticate();
      const res = await fetch(`${instanceUrl}/services/data/${API_VERSION}/sobjects`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error(`Salesforce API returned ${res.status}`);
      const userInfo = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const orgId = userInfo.ok ? ((await userInfo.json()) as { organization_id?: string }).organization_id : undefined;
      return { ok: true, instanceUrl, orgId };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }
}
