# Security & Quality Review — serviceflow-sdm

_Reviewed against [Project CodeGuard](https://github.com/cisco-open/project-codeguard) rules: codeguard-1-hardcoded-credentials, codeguard-1-crypto-algorithms, codeguard-0-authentication-mfa, codeguard-0-authorization-access-control, codeguard-0-input-validation-injection, codeguard-0-api-web-services, codeguard-0-session-management-and-cookies._

---

## Summary

| Severity       | Count |
|----------------|-------|
| High           | 4     |
| Medium         | 6     |
| Low / Quality  | 5     |

---

## High

### H1 — SSO callback delivers tokens in the URL hash fragment

**File:** `backend/src/routes/sso.ts:214–220`

```ts
target.hash = hash;  // hash = "accessToken=...&refreshToken=..."
res.redirect(302, target.toString());
```

Both the access and refresh tokens are appended to the redirect URL as a hash fragment. Although hash fragments are not sent in HTTP requests to servers, they are: (a) stored in browser history, (b) accessible by any script running on the landing page, and (c) potentially leaked via referrer headers if the page immediately navigates elsewhere. A stolen refresh token is valid for 7 days by default.

**Fix:** Use a short-lived, single-use server-side code at the redirect target that the frontend immediately exchanges for tokens via a `POST`, or set the tokens as `HttpOnly`, `Secure`, `SameSite=Strict` cookies on the callback response directly.

---

### H2 — Access tokens are long-lived with no revocation mechanism

**Files:** `backend/src/config.ts:24`, `backend/src/routes/auth.ts:78`

```ts
JWT_EXPIRE: z.string().default("24h")
```

The default access token lifetime is 24 hours. `POST /auth/logout` returns `204` without invalidating the token server-side. A leaked token stays valid for up to 24 hours.

**Fix:** Reduce `JWT_EXPIRE` to `15m`–`1h`. Implement a Redis-backed JWT denylist keyed by `jti` (JWT ID). On logout, add the `jti` to the denylist with TTL equal to the token's remaining lifetime. Check the denylist in `requireAuth`.

---

### H3 — No rate limiting on authentication endpoints

**File:** `backend/src/routes/auth.ts`

`POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` have no rate limiting. An attacker can make unlimited password-guessing attempts or attempt to brute-force valid refresh tokens. The security hardening checklist acknowledges this gap.

**Fix:** Add `express-rate-limit` (already a common dependency) to these endpoints:

```ts
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" }
});

authRouter.post("/login", loginLimiter, async (req, res) => { ... });
```

---

### H4 — All data routes lack property/tenant scoping (IDOR risk)

**Files:** `backend/src/routes/incidents.ts:39`, `backend/src/routes/devices.ts:17`, `backend/src/routes/properties.ts:14`

```ts
// Any authenticated user gets every incident
const result = await pool.query(
  `SELECT ... FROM mgm.incidents ORDER BY created_at DESC`
);
```

A `viewer`-role user can read all incidents, devices, and properties across all tenants. There is no row-level filtering by the requesting user's assigned properties.

**Fix:** Add a `property_ids` or `assigned_properties` column to `mgm.users`. Filter all list queries through `WHERE property_id = ANY($1::uuid[])` using the authenticated user's allowed properties. For admin/sdm roles, allow the unscoped query.

---

## Medium

### M1 — JWT_SECRET and JWT_REFRESH_SECRET share the same default value

**File:** `backend/src/config.ts:22–23`

```ts
JWT_SECRET: z.string().min(32).default("replace_with_32_plus_chars_replace"),
JWT_REFRESH_SECRET: z.string().min(32).default("replace_with_32_plus_chars_replace"),
```

Both secrets have an identical placeholder. If a developer starts the server without setting these, both secrets are the same — meaning a refresh token can be verified as an access token and vice versa, partially bypassing token type separation.

**Fix:** Use distinct defaults that clearly differ, or — better — fail at startup if either is set to the placeholder value:

```ts
JWT_SECRET: z.string().min(32).refine(v => v !== "replace_with_32_plus_chars_replace", {
  message: "JWT_SECRET must be changed from the default placeholder"
}),
```

---

### M2 — docker-compose.yml loads .env.example as its env_file

**File:** `docker-compose.yml:36`

```yaml
env_file:
  - .env.example
```

The Docker backend container is configured to load `.env.example` directly, meaning placeholder values like `change_me`, `replace_with_32_plus_chars`, and `replace_me` are the live secrets when running `docker compose up`. Anyone following the repo README and running compose without setup will have a fully running server with known-weak credentials.

**Fix:** Change the compose file to load `.env` (which is gitignored) and add a `Makefile` or setup script that copies `.env.example` to `.env` with a warning to populate it:

```yaml
env_file:
  - .env  # Copy .env.example to .env and populate before running
```

---

### M3 — sourceAdmin still uses an if-chain for sync dispatch

**File:** `backend/src/routes/sourceAdmin.ts:159–193`

The `POST /admin/sources/:sourceName/test` route duplicates the exact same if-chain pattern across the same 4 sync sources that was refactored in `integrations.ts`. Changes to sync behavior must now be made in two places.

**Fix:** Share the `syncHandlers` map from `integrations.ts` by exporting it, or extract it to a shared `syncHandlers.ts` module imported by both routes.

---

### M4 — ensureTable() runs on every request

**File:** `backend/src/routes/sourceAdmin.ts:43–83`

```ts
sourceAdminRouter.get("/sources", requireAuth, ..., async (_req, res) => {
  await ensureTable();  // CREATE TABLE IF NOT EXISTS on every GET
```

`ensureTable()` is called on both the GET and PUT handlers, issuing a `CREATE TABLE IF NOT EXISTS` (plus 19 `INSERT ... ON CONFLICT DO NOTHING` rows) on every single request. PostgreSQL handles these cheaply but it's unnecessary overhead and a migration anti-pattern — schema changes belong in the migration files, not request handlers.

**Fix:** Move table creation to `infra/migrations/` as a proper migration. Remove `ensureTable()`.

---

### M5 — bcrypt round count is hardcoded, not read from config

**File:** `backend/src/routes/sso.ts:183`

```ts
const unusableHash = await bcrypt.hash(`jit-sso:${randomUUID()}`, 12);
```

The `.env.example` defines `BCRYPT_ROUNDS=12`, but neither `config.ts` nor the code reads it — the round count is hardcoded to `12`. This is fine today but makes tuning harder.

**Fix:** Add `BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(20).default(12)` to `config.ts` and use `env.BCRYPT_ROUNDS` everywhere bcrypt is called.

---

### M6 — sourceAdmin.put exposes Zod validation error details

**File:** `backend/src/routes/sourceAdmin.ts:119`

```ts
res.status(400).json({ message: "Invalid request", issues: parsed.error.issues });
```

This is the only route that returns `parsed.error.issues`, which exposes internal field names and validation logic to clients. All other routes return only `{ message: "Invalid request" }`.

**Fix:** Remove `issues` from the response:

```ts
res.status(400).json({ message: "Invalid request" });
```

---

## Low / Code Quality

### L1 — Salesforce uses the deprecated OAuth 2.0 password flow

**File:** `backend/src/integrations/salesforceClient.ts:39–44`

```ts
grant_type: "password",
```

The OAuth 2.0 Resource Owner Password Credentials (ROPC) flow is deprecated by the OAuth 2.0 Security Best Current Practices (RFC 9700). Salesforce itself discourages it in favor of connected app client credentials or JWT bearer token flows for service accounts.

**Recommendation:** Migrate to the OAuth 2.0 client credentials flow (`grant_type=client_credentials`) or JWT bearer (`urn:ietf:params:oauth:grant-type:jwt-bearer`) when Salesforce is upgraded beyond the current connected app.

---

### L2 — runSmartLicensingSync is a no-op

**File:** `backend/src/jobs/syncService.ts:47–56`

```ts
const entitlements = await client.getEntitlements();
return entitlements.length;  // fetched but never persisted
```

The function fetches entitlements from Smart Licensing but discards the result without writing anything to the database. It reports a non-zero `processed` count that implies successful work.

**Fix:** Either implement the persistence, or return `0` and emit a log message indicating the sync step is not yet implemented.

---

### L3 — No GET /:id routes for incidents, devices, or properties

**Files:** `incidents.ts`, `devices.ts`, `properties.ts`

The API only supports listing all records. There is no way to fetch a single incident, device, or property by ID. Frontend components typically need this for detail views and after create operations.

---

### L4 — tac.ts hardcodes LIMIT 200 with no pagination

**File:** `backend/src/routes/tac.ts:8–13`

The TAC cases route hardcodes a `LIMIT 200` with no `offset` or cursor-based pagination. As TAC cases accumulate this becomes a performance concern.

---

### L5 — DnaCenterClient silently swallows all HTTP errors

**File:** `backend/src/integrations/dnaCenterClient.ts`

```ts
if (!response.ok) return "";   // auth failure
if (!response.ok) return [];   // listDevices failure
```

Both error paths return empty values without logging anything. A misconfigured host, expired password, or network error is indistinguishable from "no devices found" in the sync job output.

**Fix:** Log a structured warning (not throw, since the caller handles the empty result) so operators can diagnose sync failures:

```ts
if (!response.ok) {
  console.warn(JSON.stringify({ level: "warn", msg: "dna_auth_failed", status: response.status }));
  return "";
}
```

---

## CodeGuard Rules Applied

- `codeguard-1-hardcoded-credentials` — H3, M1, M2
- `codeguard-0-authentication-mfa` — H2, H3, M1
- `codeguard-0-authorization-access-control` — H4
- `codeguard-0-session-management-and-cookies` — H1, H2
- `codeguard-0-api-web-services` — H3, H4
- `codeguard-0-input-validation-injection` — M6
- `codeguard-1-crypto-algorithms` — No violations found (bcrypt is used correctly; no broken hash algorithms detected)
