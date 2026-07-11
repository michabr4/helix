import { randomUUID } from "node:crypto";
import type { Router } from "express";
import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import * as client from "openid-client";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { env } from "../config.js";
import { redis } from "../redis.js";
import type { AppRole, AuthContext } from "../middleware/auth.js";

const JIT_ROLES: ReadonlySet<AppRole> = new Set([
  "admin",
  "sdm",
  "tam",
  "csm",
  "engineer",
  "manager",
  "viewer"
]);

type SsoCookiePayload = {
  code_verifier: string;
  state: string;
  nonce: string;
};

const COOKIE = "sso_oidc";
const COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function ssoCookieSecret(): string {
  return env.JWT_SECRET;
}

function setSsoCookie(res: Response, payload: SsoCookiePayload): void {
  const body = jwt.sign(payload, ssoCookieSecret(), { expiresIn: "10m" });
  res.cookie(COOKIE, body, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/"
  });
}

function readSsoCookie(req: Request): SsoCookiePayload | null {
  const raw = req.cookies?.[COOKIE] as string | undefined;
  if (!raw) return null;
  try {
    return jwt.verify(raw, ssoCookieSecret()) as SsoCookiePayload;
  } catch {
    return null;
  }
}

function clearSsoCookie(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
}

let discoveryCache: Promise<client.Configuration> | null = null;

async function getOidcConfig(): Promise<client.Configuration> {
  if (!discoveryCache) {
    const issuer = new URL(env.SSO_ISSUER);
    const auth = env.SSO_CLIENT_SECRET
      ? client.ClientSecretPost(env.SSO_CLIENT_SECRET)
      : client.None();
    discoveryCache = client.discovery(issuer, env.SSO_CLIENT_ID, undefined, auth);
  }
  return discoveryCache;
}

function callbackRequestUrl(req: Request): URL {
  const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
  return new URL(req.originalUrl || req.url, `${base}/`);
}

function emailFromClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;
  const candidates = [c.email, c.mail, c.preferred_username, c.upn, c.unique_name];
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const s = raw.trim().toLowerCase();
    if (s.includes("@")) return s;
  }
  return null;
}

function fullNameFromClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;
  const direct = c.name;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const gn = c.given_name;
  const fn = c.family_name;
  if (typeof gn === "string" && typeof fn === "string" && (gn.trim() || fn.trim())) {
    return `${gn.trim()} ${fn.trim()}`.trim();
  }
  if (typeof gn === "string" && gn.trim()) return gn.trim();
  if (typeof fn === "string" && fn.trim()) return fn.trim();
  return null;
}

export function attachSsoRoutes(router: Router): void {
  router.get("/sso/discovery", (_req, res) => {
    res.json({
      enabled: env.SSO_ENABLED,
      issuer: env.SSO_ENABLED ? env.SSO_ISSUER : undefined,
      clientId: env.SSO_ENABLED ? env.SSO_CLIENT_ID : undefined,
      scopes: env.SSO_ENABLED ? env.SSO_SCOPES : undefined,
    });
  });

  router.get("/sso/login", async (req, res) => {
    if (!env.SSO_ENABLED) {
      res.status(404).json({ message: "SSO is not enabled" });
      return;
    }

    try {
      const config = await getOidcConfig();
      const code_verifier = client.randomPKCECodeVerifier();
      const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
      const state = client.randomState();
      const nonce = client.randomNonce();

      setSsoCookie(res, { code_verifier, state, nonce });

      const redirectTo = client.buildAuthorizationUrl(config, {
        redirect_uri: env.SSO_REDIRECT_URI!,
        scope: env.SSO_SCOPES,
        code_challenge,
        code_challenge_method: "S256",
        state,
        nonce
      });
      res.redirect(redirectTo.href);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", message: "sso_login_failed", error: String(e) }));
      res.status(502).json({ message: "SSO configuration error" });
    }
  });

  router.get("/sso/callback", async (req, res) => {
    if (!env.SSO_ENABLED) {
      res.status(404).json({ message: "SSO is not enabled" });
      return;
    }

    const sess = readSsoCookie(req);
    if (!sess) {
      res.status(400).json({ message: "Invalid or expired sign-in session" });
      return;
    }
    clearSsoCookie(res);

    try {
      const config = await getOidcConfig();
      const tokens = await client.authorizationCodeGrant(config, callbackRequestUrl(req), {
        expectedNonce: sess.nonce,
        expectedState: sess.state,
        pkceCodeVerifier: sess.code_verifier
      });

      const claims = tokens.claims();
      const email = emailFromClaims(claims);
      if (!email) {
        res.status(403).json({ message: "Identity provider did not return an email claim" });
        return;
      }

      let result = await pool.query(
        "SELECT user_id, role FROM mgm.users WHERE lower(trim(email)) = $1 LIMIT 1",
        [email]
      );
      let user = result.rows[0];

      const jitRoleRaw = (env.SSO_JIT_DEFAULT_ROLE || "").trim().toLowerCase();
      if (!user && jitRoleRaw && JIT_ROLES.has(jitRoleRaw as AppRole)) {
        const jitRole = jitRoleRaw as AppRole;
        const fullName = fullNameFromClaims(claims) || email.split("@")[0] || "SSO user";
        const unusableHash = await bcrypt.hash(`jit-sso:${randomUUID()}`, env.BCRYPT_ROUNDS);
        await pool.query(
          `INSERT INTO mgm.users (email, full_name, role, password_hash)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO NOTHING`,
          [email, fullName, jitRole, unusableHash]
        );
        result = await pool.query(
          "SELECT user_id, role FROM mgm.users WHERE lower(trim(email)) = $1 LIMIT 1",
          [email]
        );
        user = result.rows[0];
      }

      if (!user) {
        res
          .status(403)
          .json({
            message:
              "No Operations account for this identity. Ask an admin to add your work email to mgm.users, or set SSO_JIT_DEFAULT_ROLE (e.g. viewer) for automatic provisioning."
          });
        return;
      }

      const base: Omit<AuthContext, "jti"> = { userId: user.user_id, role: user.role };

      // Issue access and refresh tokens with unique jti for denylist support
      const accessJti = randomUUID();
      const refreshJti = randomUUID();
      const accessToken = jwt.sign({ ...base, jti: accessJti }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRE as SignOptions["expiresIn"],
        jwtid: accessJti
      });
      const refreshToken = jwt.sign({ ...base, jti: refreshJti }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRE as SignOptions["expiresIn"],
        jwtid: refreshJti
      });

      // Store tokens under a single-use code (60 s TTL) so they never appear in a URL fragment.
      // The frontend exchanges this code via POST /api/v1/auth/sso/exchange.
      const code = randomUUID();
      await redis.set(
        `sso:exchange:${code}`,
        JSON.stringify({ accessToken, refreshToken }),
        "EX",
        60
      );

      const target = new URL(env.SSO_SUCCESS_REDIRECT);
      target.searchParams.set("sso_code", code);
      res.redirect(302, target.toString());
    } catch (e) {
      console.error(JSON.stringify({ level: "error", message: "sso_callback_failed", error: String(e) }));
      res.status(401).json({ message: "Sign-in failed" });
    }
  });
}
