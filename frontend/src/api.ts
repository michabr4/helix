const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

// ─── Token storage ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

function storeTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// ─── Token refresh ────────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

/** Attempt to silently refresh the access token. Returns true on success. */
async function tryRefresh(): Promise<boolean> {
  // Coalesce concurrent refresh attempts into one request
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) { clearTokens(); return false; }
      const json = (await res.json()) as { accessToken?: string };
      if (!json.accessToken) { clearTokens(); return false; }
      storeTokens(json.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Authenticated fetch with automatic token refresh.
 * On a 401 response it attempts one silent refresh, then retries.
 * If the refresh fails it clears tokens and re-throws so the caller can
 * redirect to /login.
 */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  let res = await fetch(url, withAuth(getAccessToken()));

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new Error("Session expired. Please sign in again.");
    res = await fetch(url, withAuth(getAccessToken()));
  }

  return res;
}

// ─── Public API helpers ───────────────────────────────────────────────────────

export type PowerBiEmbedDisabled = { enabled: false; message?: string };
export type PowerBiEmbedReady = {
  enabled: true;
  embedUrl: string;
  embedToken: string;
  reportId: string;
  reportName: string;
  tokenExpiry: string;
  workspaceId: string;
};
export type PowerBiEmbedResponse = PowerBiEmbedDisabled | PowerBiEmbedReady;

export async function fetchPowerBiEmbed(): Promise<PowerBiEmbedResponse> {
  const response = await authFetch(`${API_BASE}/analytics/powerbi/embed`);
  const data = (await response.json()) as PowerBiEmbedResponse & { message?: string };
  if (!response.ok) throw new Error(data.message ?? `Request failed: ${response.status}`);
  return data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? `Request failed: ${response.status}`);
  }
  return response.json();
}

// ─── Auth flows ───────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_BASE}. Is the backend running (e.g. npm start on port 3000)?`
    );
  }
  const json = (await response.json().catch(() => ({}))) as {
    message?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  if (!response.ok) throw new Error(json.message || "Invalid username or password");
  if (!json.accessToken) throw new Error("Login response missing token");
  storeTokens(json.accessToken, json.refreshToken);
}

export async function logout(): Promise<void> {
  try {
    await authFetch(`${API_BASE}/auth/logout`, { method: "POST" });
  } catch {
    // Best-effort — always clear local tokens
  }
  clearTokens();
}

/**
 * Exchange a one-time SSO code (from ?sso_code= query param) for tokens.
 * Called by the app on initial load when the SSO redirect lands here.
 */
export async function exchangeSsoCode(code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/sso/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (!res.ok) throw new Error("SSO sign-in failed. Please try again.");
  const json = (await res.json()) as { accessToken?: string; refreshToken?: string };
  if (!json.accessToken) throw new Error("SSO exchange returned no token");
  storeTokens(json.accessToken, json.refreshToken);
}
