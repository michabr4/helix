import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sf_access_token";
const REFRESH_KEY = "sf_refresh_token";

let apiBase = "http://localhost:3000/api/v1";

export function setApiBase(url: string) {
  apiBase = url.replace(/\/$/, "");
}

export function getApiBase(): string {
  return apiBase;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setTokens(access: string, refresh?: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${apiBase}${path}`, { headers });
  if (res.status === 401) throw new AuthError("Session expired");
  if (!res.ok) throw new ApiError(`Request failed: ${res.status}`, res.status);
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AuthError("Session expired");
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(
      (json as { message?: string }).message ?? `Request failed: ${res.status}`,
      res.status
    );
  }
  return res.json();
}

export async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${apiBase}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AuthError("Session expired");
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(
      (json as { message?: string }).message ?? `Request failed: ${res.status}`,
      res.status
    );
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  if (!res.ok) throw new ApiError(json.message ?? "Invalid username or password", res.status);
  if (!json.accessToken) throw new ApiError("Login response missing token", 500);
  await setTokens(json.accessToken, json.refreshToken);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
