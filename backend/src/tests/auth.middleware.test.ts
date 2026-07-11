/**
 * Tests for requireAuth and requireRoles middleware.
 *
 * requireAuth is async and depends on:
 *  - jsonwebtoken.verify (sync)
 *  - redis.get (async) for the revocation denylist
 *
 * We mock both modules so tests run without any real DB/Redis connection.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Module mocks (must be hoisted before imports) ---

vi.mock("../config.js", () => ({
  env: {
    JWT_SECRET: "a-test-secret-that-is-at-least-32-chars!",
    JWT_REFRESH_SECRET: "another-test-secret-also-32-chars-xx",
    JWT_EXPIRE: "15m"
  }
}));

vi.mock("../redis.js", () => ({
  redis: {
    get: vi.fn()
  }
}));

// Import after mocks are registered
import jwt from "jsonwebtoken";
import { redis } from "../redis.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

// --- Helpers ---

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json, headersSent: false } as any;
}

function makeNext() {
  return vi.fn();
}

function signToken(payload: object, secret = "a-test-secret-that-is-at-least-32-chars!", options: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, { expiresIn: "15m", ...options });
}

// --- requireAuth ---

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: denylist miss (not revoked)
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as any;
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is malformed / wrong secret", async () => {
    const badToken = signToken({ userId: "u1", role: "viewer" }, "wrong-secret-xxxxxxxxxxxxxxxxxxxx");
    const req = { header: vi.fn().mockReturnValue(`Bearer ${badToken}`) } as any;
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", async () => {
    const expiredToken = signToken(
      { userId: "u1", role: "viewer", jti: "jti-1" },
      "a-test-secret-that-is-at-least-32-chars!",
      { expiresIn: -1 } // already expired
    );
    const req = { header: vi.fn().mockReturnValue(`Bearer ${expiredToken}`) } as any;
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets req.auth for a valid token", async () => {
    const token = signToken({ userId: "user-123", role: "sdm", jti: "jti-abc" });
    const req = { header: vi.fn().mockReturnValue(`Bearer ${token}`) } as any;
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth).toMatchObject({ userId: "user-123", role: "sdm" });
  });

  it("checks the Redis denylist for tokens that have a jti", async () => {
    const jti = "test-jti-revoked";
    const token = signToken({ userId: "u2", role: "admin", jti });
    const req = { header: vi.fn().mockReturnValue(`Bearer ${token}`) } as any;
    const res = makeRes();
    const next = makeNext();

    // Simulate denylist hit — token has been revoked
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue("1");

    await requireAuth(req, res, next);

    expect(redis.get).toHaveBeenCalledWith(`denylist:${jti}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails open when Redis is unavailable — request proceeds normally", async () => {
    const token = signToken({ userId: "u3", role: "viewer", jti: "jti-redis-down" });
    const req = { header: vi.fn().mockReturnValue(`Bearer ${token}`) } as any;
    const res = makeRes();
    const next = makeNext();

    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

    await requireAuth(req, res, next);

    // Even though Redis threw, the request should proceed — fail-open
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("skips denylist check when token has no jti", async () => {
    // Token without jti (legacy or externally issued)
    const token = signToken({ userId: "u4", role: "viewer" });
    const req = { header: vi.fn().mockReturnValue(`Bearer ${token}`) } as any;
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(redis.get).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

// --- requireRoles ---

describe("requireRoles", () => {
  it("blocks a role that is not in the allowed list", () => {
    const middleware = requireRoles(["admin"]);
    const req = { auth: { role: "viewer" } } as any;
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a role that is in the allowed list", () => {
    const middleware = requireRoles(["admin", "sdm"]);
    const req = { auth: { role: "sdm" } } as any;
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks when req.auth is missing", () => {
    const middleware = requireRoles(["admin"]);
    const req = {} as any;
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows every role in the allowed list", () => {
    const roles = ["admin", "sdm", "tam", "csm", "engineer", "manager"] as const;
    const middleware = requireRoles([...roles]);

    for (const role of roles) {
      const req = { auth: { role } } as any;
      const res = makeRes();
      const next = makeNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    }
  });
});
