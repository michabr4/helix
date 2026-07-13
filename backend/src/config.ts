import "dotenv/config";
import { z } from "zod";

const boolish = z.preprocess(
  (v) => v === true || v === "true" || v === "1" || v === "yes",
  z.boolean()
);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(3000),
    /** Public origin for OAuth redirect URL construction (no trailing slash). */
    APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(5432),
    DB_NAME: z.string().default("helix_sdm"),
    DB_USER: z.string().default("serviceflow_admin"),
    DB_PASSWORD: z.string().default("change_me"),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    JWT_SECRET: z
      .string()
      .min(32)
      .default("replace_with_32_plus_chars_replace")
      .refine((v) => v !== "replace_with_32_plus_chars_replace", {
        message: "JWT_SECRET must be set to a unique random value — do not use the placeholder"
      }),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32)
      .default("replace_with_32_plus_chars_replace_2")
      .refine((v) => v !== "replace_with_32_plus_chars_replace_2", {
        message: "JWT_REFRESH_SECRET must be set to a unique random value — do not use the placeholder"
      }),
    JWT_EXPIRE: z.string().default("15m"),
    JWT_REFRESH_EXPIRE: z.string().default("7d"),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(20).default(12),
    /** Comma-separated allowed browser origins (Vite + Operations on :3000 for local tools that call the API cross-origin). */
    CORS_ORIGIN: z.string().default("http://localhost:3001,http://localhost:3000"),
    TAC_BASE_URL: z.string().default("https://tools.cisco.com/tac/api/v2"),
    TAC_API_KEY: z.string().default(""),
    TAC_API_SECRET: z.string().default(""),
    DNA_CENTER_HOST: z.string().default(""),
    DNA_CENTER_USERNAME: z.string().default(""),
    DNA_CENTER_PASSWORD: z.string().default(""),
    DNA_CENTER_PORT: z.coerce.number().default(443),
    SMART_LICENSING_TOKEN_URL: z.string().default("https://cloudsso.cisco.com/as/token.oauth2"),
    SMART_LICENSING_API_URL: z.string().default("https://swapi.cisco.com/services/api/smart-accounts-and-licensing"),
    SMART_LICENSING_CLIENT_ID: z.string().default(""),
    SMART_LICENSING_CLIENT_SECRET: z.string().default(""),

    /**
     * Cisco IQ (Wave 9) — adoption/entitlement insights. Endpoint shape is
     * an unverified assumption (see ciscoIqClient.ts header comment) —
     * confirm against real API docs before flipping `cisco-iq.enabled` in
     * mgm.integration_source_configs.
     */
    CISCO_IQ_TOKEN_URL: z.string().default("https://cloudsso.cisco.com/as/token.oauth2"),
    CISCO_IQ_API_URL: z.string().default("https://api.iq.cisco.com"),
    CISCO_IQ_CLIENT_ID: z.string().default(""),
    CISCO_IQ_CLIENT_SECRET: z.string().default(""),

    /** OpenID Connect SSO (authorization code + PKCE). */
    SSO_ENABLED: boolish.optional().default(false),
    SSO_ISSUER: z.string().optional().default(""),
    SSO_CLIENT_ID: z.string().optional().default(""),
    SSO_CLIENT_SECRET: z.string().optional().default(""),
    /** Must match IdP app registration (usually `${APP_PUBLIC_URL}/api/v1/auth/sso/callback`). */
    SSO_REDIRECT_URI: z.string().url().optional(),
    /** After SSO, browser redirect with tokens in URL hash (fragment not sent to servers). */
    SSO_SUCCESS_REDIRECT: z.string().url().default("http://localhost:3000/"),
    SSO_SCOPES: z.string().default("openid profile email"),
    /**
     * If set (e.g. viewer, engineer), first-time SSO users get an mgm.users row with this role.
     * Empty = only existing users may sign in (email must match mgm.users).
     */
    SSO_JIT_DEFAULT_ROLE: z.string().optional().default(""),

    /**
     * Power BI — embed Global PM dashboard (service principal / app-only).
     * Workspace must grant the SP access; see docs/POWERBI_GLOBAL_PM.md.
     */
    POWERBI_ENABLED: boolish.optional().default(false),
    POWERBI_TENANT_ID: z.string().optional().default(""),
    POWERBI_CLIENT_ID: z.string().optional().default(""),
    POWERBI_CLIENT_SECRET: z.string().optional().default(""),
    POWERBI_WORKSPACE_ID: z.string().optional().default(""),
    POWERBI_REPORT_ID: z.string().optional().default(""),

    /** Webex bot access token (create messaging spaces / rooms). See https://developer.webex.com/docs/bots */
    WEBEX_BOT_TOKEN: z.string().optional().default(""),

    /** Salesforce integration (OAuth 2.0 password flow — connected app). */
    SALESFORCE_ENABLED: boolish.optional().default(false),
    SALESFORCE_LOGIN_URL: z.string().url().default("https://login.salesforce.com"),
    SALESFORCE_CLIENT_ID: z.string().optional().default(""),
    SALESFORCE_CLIENT_SECRET: z.string().optional().default(""),
    SALESFORCE_USERNAME: z.string().optional().default(""),
    SALESFORCE_PASSWORD: z.string().optional().default(""),
    SALESFORCE_SECURITY_TOKEN: z.string().optional().default(""),
    SALESFORCE_API_VERSION: z.string().optional().default("v59.0"),
    /**
     * OAuth flow for Salesforce. "client_credentials" (recommended) uses the
     * OAuth 2.0 Client Credentials flow — requires the Connected App to have
     * "Client Credentials Flow" enabled and a "Run As" user assigned.
     * "password" (legacy/deprecated) uses the Resource Owner Password flow.
     * Defaults to "password" for backward compatibility.
     */
    SALESFORCE_OAUTH_FLOW: z.enum(["password", "client_credentials"]).default("password")
  })
  .superRefine((data, ctx) => {
    if (!data.SSO_ENABLED) return;
    if (!data.SSO_ISSUER)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSO_ISSUER required when SSO_ENABLED", path: ["SSO_ISSUER"] });
    if (!data.SSO_CLIENT_ID)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSO_CLIENT_ID required when SSO_ENABLED", path: ["SSO_CLIENT_ID"] });
    if (!data.SSO_REDIRECT_URI)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SSO_REDIRECT_URI required when SSO_ENABLED",
        path: ["SSO_REDIRECT_URI"]
      });
  })
  .superRefine((data, ctx) => {
    if (!data.POWERBI_ENABLED) return;
    const need: [keyof typeof data, string][] = [
      ["POWERBI_TENANT_ID", "POWERBI_TENANT_ID"],
      ["POWERBI_CLIENT_ID", "POWERBI_CLIENT_ID"],
      ["POWERBI_CLIENT_SECRET", "POWERBI_CLIENT_SECRET"],
      ["POWERBI_WORKSPACE_ID", "POWERBI_WORKSPACE_ID"],
      ["POWERBI_REPORT_ID", "POWERBI_REPORT_ID"]
    ];
    for (const [key, path] of need) {
      if (!String(data[key] || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${path} required when POWERBI_ENABLED`,
          path: [path]
        });
      }
    }
  })
  .superRefine((data, ctx) => {
    if (!data.SALESFORCE_ENABLED) return;
    const need: [keyof typeof data, string][] = [
      ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_ID"],
      ["SALESFORCE_CLIENT_SECRET", "SALESFORCE_CLIENT_SECRET"],
      ["SALESFORCE_USERNAME", "SALESFORCE_USERNAME"],
      ["SALESFORCE_PASSWORD", "SALESFORCE_PASSWORD"]
    ];
    for (const [key, path] of need) {
      if (!String(data[key] || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${path} required when SALESFORCE_ENABLED`,
          path: [path]
        });
      }
    }
  });

export const env = EnvSchema.parse(process.env);
