import { randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db.js";
import { env } from "../config.js";
import { redis } from "../redis.js";
import { requireAuth, type AuthContext } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { attachSsoRoutes } from "./sso.js";

export const authRouter = Router();
attachSsoRoutes(authRouter);

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

/** Sign an access token with a fresh jti for revocation support. */
function signAccessToken(payload: Omit<AuthContext, "jti">): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as jwt.SignOptions["expiresIn"],
    jwtid: jti,
  });
}

/** Sign a refresh token with a fresh jti. */
function signRefreshToken(payload: Omit<AuthContext, "jti">): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRE as jwt.SignOptions["expiresIn"],
    jwtid: jti,
  });
}

authRouter.post("/login", authRateLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request: use a valid email and a password of at least 8 characters."
    });
    return;
  }

  try {
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const result = await pool.query(
      "SELECT user_id, role, password_hash FROM mgm.users WHERE lower(trim(email)) = $1 LIMIT 1",
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const base: Omit<AuthContext, "jti"> = { userId: user.user_id, role: user.role };
    const accessToken = signAccessToken(base);
    const refreshToken = signRefreshToken(base);
    res.json({ accessToken, refreshToken });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

authRouter.post("/refresh", authRateLimiter, (req, res) => {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!token) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthContext;
    // Re-sign with only application claims — never carry over stale iat/exp/jti.
    const base: Omit<AuthContext, "jti"> = { userId: decoded.userId, role: decoded.role };
    const accessToken = signAccessToken(base);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  // Add the token's jti to the Redis denylist so it's invalid immediately, even
  // before it expires. TTL = remaining token lifetime.
  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (token) {
    try {
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti) {
        const ttl = decoded.exp
          ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
          : 900; // fallback: 15 min
        await redis.set(`denylist:${decoded.jti}`, "1", "EX", ttl);
      }
    } catch {
      // Best-effort — still send 204
    }
  }
  res.status(204).send();
});

/**
 * POST /api/v1/auth/sso/exchange
 * Frontend calls this with the one-time code from the SSO redirect query param
 * to receive { accessToken, refreshToken } without tokens ever appearing in a URL fragment.
 */
authRouter.post("/sso/exchange", async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  try {
    // GETDEL is atomic: reads and deletes in one round-trip (single-use guarantee)
    const raw = await redis.getdel(`sso:exchange:${code}`);
    if (!raw) {
      res.status(401).json({ message: "Code is invalid or has expired" });
      return;
    }
    const tokens = JSON.parse(raw) as { accessToken: string; refreshToken: string };
    res.json(tokens);
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});
