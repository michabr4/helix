import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import {
  login as apiLogin,
  clearTokens,
  getToken,
  setTokens,
  AuthError,
  getApiBase,
} from "../api";

WebBrowser.maybeCompleteAuthSession();

export interface SsoConfig {
  issuer: string;
  clientId: string;
  scopes: string[];
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  ssoConfig: SsoConfig | null;
}

interface AuthContextValue extends AuthState {
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  loginWithSso: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    ssoConfig: null,
  });

  useEffect(() => {
    (async () => {
      const token = await getToken();

      let ssoConfig: SsoConfig | null = null;
      try {
        const res = await fetch(`${getApiBase()}/auth/sso/discovery`);
        if (res.ok) {
          const data = (await res.json()) as {
            enabled?: boolean;
            issuer?: string;
            clientId?: string;
            scopes?: string;
          };
          if (data.enabled && data.issuer && data.clientId) {
            ssoConfig = {
              issuer: data.issuer,
              clientId: data.clientId,
              scopes: (data.scopes ?? "openid profile email").split(" "),
            };
          }
        }
      } catch {
        /* SSO discovery optional */
      }

      setState({
        isLoading: false,
        isAuthenticated: !!token,
        ssoConfig,
      });
    })();
  }, []);

  const loginWithCredentials = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      setState((s) => ({ ...s, isAuthenticated: true }));
    },
    []
  );

  const loginWithSso = useCallback(async () => {
    if (!state.ssoConfig) throw new Error("SSO not configured");

    const discovery = await AuthSession.fetchDiscoveryAsync(
      state.ssoConfig.issuer
    );

    const redirectUri = AuthSession.makeRedirectUri({
      scheme: "helix-sdm",
      path: "auth/callback",
    });

    const request = new AuthSession.AuthRequest({
      clientId: state.ssoConfig.clientId,
      scopes: state.ssoConfig.scopes,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });

    const result = await request.promptAsync(discovery, {
      showInRecents: true,
      ...(Platform.OS === "android" ? { createTask: false } : {}),
    });

    if (result.type === "success" && result.params.code) {
      const tokenRes = await AuthSession.exchangeCodeAsync(
        {
          clientId: state.ssoConfig.clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier! },
        },
        discovery
      );

      if (tokenRes.accessToken) {
        await setTokens(tokenRes.accessToken, tokenRes.refreshToken ?? undefined);
        setState((s) => ({ ...s, isAuthenticated: true }));
      }
    } else if (result.type === "error") {
      throw new AuthError(result.error?.message ?? "SSO authentication failed");
    }
  }, [state.ssoConfig]);

  const logout = useCallback(async () => {
    await clearTokens();
    setState((s) => ({ ...s, isAuthenticated: false }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      loginWithCredentials,
      loginWithSso,
      logout,
    }),
    [state, loginWithCredentials, loginWithSso, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
