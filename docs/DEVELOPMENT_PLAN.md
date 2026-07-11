# ServiceFlow SDM — Development Plan

Generated: June 24, 2026 · Based on BRD v1.0, Executive Walkthrough, and Helix Agentic Framework v2

> **Correction (verified 2026-07-09):** This plan's Phase 4/5 claims below are stale. A direct code
> audit of `backend/src/agents/`, `backend/src/jobs/`, and `backend/src/routes/agents.ts` found the
> agentic infrastructure **and 4 of the Tier 1 agents already built and running** — not "Zero" as
> stated in the June 24 snapshot. See the ✅/⚠️ markers inline in Phase 4/5 and the corrected
> "What Is Not Built" table below. Everything else in this doc (Phases 0–3, 6–8, Integration Waves,
> Mobile) was spot-checked and still reflects real gaps.

---

## Current State Assessment

### What Is Solid

The backend is in strong shape. Auth (JWT, refresh, jti denylist, OIDC SSO, rate limiting), incidents, devices, properties, TAC, Salesforce, Power BI, integration source registry, background cron scheduler, Redis-backed token revocation, role-based scoping, audit middleware, correlation IDs, global error handler, and OpenAPI spec are all built and security-hardened. The SupportApiClient (Coverage, EoX, Bug) is implemented **but not wired into any route or job — dead code, zero imports found elsewhere in `backend/src`.** Three database migrations exist. The Helix mockup standalone (`dist/helix-mockup-standalone/`) is a fully realized ~4,600-line static prototype showing every screen the live app needs to match.

**Also solid, confirmed 2026-07-09 (not reflected in the June 24 snapshot below):** the agentic layer. `backend/src/agents/llm.ts` wraps `@anthropic-ai/sdk` (`claude-3-5-sonnet-20241022`); `backend/src/agents/base.ts` implements the Observe→Reason→Act→Report cycle with human-approval persistence to `mgm.agent_jobs`/`mgm.agent_approvals`; four concrete agents (`incidentFirstResponse.ts`, `slaMonitor.ts`, `postIncidentDoc.ts`, `statusReport.ts`) run real Postgres queries and real LLM calls; all four are scheduled via cron in `jobs/scheduler.ts` and exposed via `routes/agents.ts`. This is Phase 4 + all of Phase 5 from this plan, already done.

### What Is Not Built

| Area | Gap |
| --- | --- |
| Frontend | 6 stub pages with hardcoded values; 12+ BRD pages missing |
| Frontend toolchain | ESLint config missing; no test files; 649KB bundle (no code splitting) |
| Backend routes | PSIRT/OpenVuln, Field Notices, Customer Health, SLA tracking, VoC ingest |
| Database schema | 9 tables needed: PSIRT, field_notices, health_scores, sla_contracts, voc_signals, journey_events, post_incident_docs, raid_log, audit_events |
| Mobile toolchain | `jest` not found; no ESLint config |
| Agentic layer, Tiers 2–4 | Agents 3, 5–7, 9, 11–20 (16 of 20) not built — see Phase 6–8 |
| Agentic layer, queue wiring | `jobs/queue.ts` (BullMQ/Redis) is scaffolded but **no worker processors consume it** — the 4 live agents run via direct cron dispatch in `scheduler.ts`, not through the queue. Either finish wiring agents through `queue.ts` for retry/concurrency control, or remove the unused scaffolding. |
| Integration source status accuracy | **New finding, 2026-07-09:** `routes/sourceAdmin.ts` seeds `fmc` as `enabled: true` with zero backend client (`fmcClient.ts` does not exist) — the registry actively misrepresents FMC as live. Inversely, `salesforce` (Wave 17) has a complete client + routes + sync handler but is seeded `enabled: false` and is absent from the mockup's own `INTEGRATION_SOURCES` array. Both are cheap, high-value fixes: flip the DB seed to match reality, and add the missing mockup array entry for Salesforce. |

### Build Stats at Last Snapshot (Apr 7, 2026)

| Module | Build | Lint | Test |
| --- | --- | --- | --- |
| backend | ✅ Pass | ❌ No eslint.config | ✅ 1 file (expanded since) |
| frontend | ✅ Pass | ❌ No eslint.config | ❌ No test files |
| mobile | — | ❌ No eslint.config | ❌ jest not found |

---

## Gap Analysis: BRD vs. Current Build

### FR Coverage

| FR | Requirement | Status |
| --- | --- | --- |
| FR-01 | Auth: local + OIDC SSO | ✅ Complete |
| FR-02 | Incidents, updates, TAC linkage | ✅ API complete; UI stub only |
| FR-03 | Device inventory + health context | ✅ API complete; UI stub only |
| FR-04 | Integration source management + test | ✅ API complete; no frontend page |
| FR-05 | Salesforce console + object views | 🔶 Route exists; UI stub only |
| FR-06 | RBAC UI + API | ✅ API complete; UI not enforcing role-based rendering |
| FR-07 | Power BI embed fallback | 🔶 Route exists; frontend minimal |

### BRD Pages vs. React App

| BRD Page | Mockup | React Page | State |
| --- | --- | --- | --- |
| Overview / KPI Command | ✅ Rich | DashboardPage (hardcoded) | ❌ Needs live API wiring |
| Incidents + TAC Linkage | ✅ | IncidentsPage (list only) | 🔶 Detail/actions missing |
| Devices + Assurance | ✅ | DevicesPage (list only) | 🔶 Health context missing |
| Properties | ✅ | PropertiesPage (list only) | 🔶 Detail missing |
| Security / PSIRT | ✅ | ❌ Missing | ❌ No page, no backend route |
| Field Notices | ✅ | ❌ Missing | ❌ No page, no backend route |
| Integrations | ✅ | ❌ Missing | ❌ No frontend page |
| Source Admin | ✅ | ❌ Missing | ❌ No frontend page |
| Sentiment / VoC | ✅ | ❌ Missing | ❌ No data model |
| Journey Views | ✅ | ❌ Missing | ❌ No data model |
| Experience Command | ✅ | ❌ Missing | ❌ No data model |
| SDC Personas Console | ✅ | ❌ Missing | ❌ No data model |
| Power BI PM | ✅ | PowerBiPmDashboardPage | 🔶 Route complete; embed minimal |
| Salesforce CRM | ✅ | SalesforcePage | 🔶 Route complete; views minimal |

---

## Schema Additions Required

Run each as a numbered migration under `infra/migrations/`.

```sql
-- 004_psirt_advisories.sql
CREATE TABLE cisco.psirt_advisories (
  advisory_id TEXT PRIMARY KEY,
  advisory_title TEXT,
  severity TEXT,
  cvss_score NUMERIC(4,1),
  cve_ids TEXT[],
  affected_products JSONB,
  publication_url TEXT,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 005_field_notices.sql
CREATE TABLE cisco.field_notices (
  fn_id TEXT PRIMARY KEY,
  title TEXT,
  product_series TEXT,
  affected_pids TEXT[],
  affected_sw_versions TEXT[],
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE mgm.device_field_notices (
  device_id UUID REFERENCES mgm.devices(device_id),
  fn_id TEXT REFERENCES cisco.field_notices(fn_id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, fn_id)
);

-- 006_sla_contracts.sql
CREATE TABLE mgm.sla_contracts (
  contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  severity TEXT NOT NULL,          -- P1, P2, P3, P4
  response_minutes INT NOT NULL,   -- SLA target in minutes
  resolve_hours INT,
  effective_from DATE,
  effective_to DATE
);
CREATE TABLE mgm.incident_sla_tracking (
  incident_id UUID PRIMARY KEY REFERENCES mgm.incidents(incident_id),
  contract_id UUID REFERENCES mgm.sla_contracts(contract_id),
  response_breached_at TIMESTAMPTZ,
  resolve_breached_at TIMESTAMPTZ,
  last_alert_pct INT DEFAULT 0     -- 50/75/90
);

-- 007_customer_health.sql
CREATE TABLE mgm.customer_health_scores (
  score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  score NUMERIC(4,1),              -- 0–100
  open_incidents INT,
  p1_active BOOLEAN,
  tac_cases_open INT,
  device_health_pct NUMERIC(4,1),
  sentiment_score NUMERIC(4,1),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 008_voc_signals.sql
CREATE TABLE mgm.voc_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  source TEXT NOT NULL,            -- nps, csat, case_note, transcript, survey
  score NUMERIC(4,1),
  text_content TEXT,
  sentiment TEXT,                  -- positive, neutral, negative
  recorded_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 009_journey_events.sql
CREATE TABLE mgm.journey_stages (
  stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  stage_name TEXT NOT NULL,        -- Evaluate, Commit, Implement, Optimize
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  status TEXT DEFAULT 'active'
);
CREATE TABLE mgm.journey_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  stage_id UUID REFERENCES mgm.journey_stages(stage_id),
  event_type TEXT,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 010_post_incident_docs.sql
CREATE TABLE mgm.post_incident_docs (
  doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES mgm.incidents(incident_id),
  timeline JSONB,                  -- array of {ts, actor, event}
  root_cause TEXT,
  resolution_steps TEXT,
  contributing_systems TEXT[],
  kb_article_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES mgm.users(user_id),
  reviewed_at TIMESTAMPTZ
);

-- 011_raid_log.sql
CREATE TABLE mgm.raid_log (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES mgm.properties(property_id),
  entry_type TEXT NOT NULL,        -- risk, assumption, issue, dependency
  title TEXT NOT NULL,
  description TEXT,
  probability TEXT,                -- high, medium, low
  impact TEXT,
  mitigation TEXT,
  owner_id UUID REFERENCES mgm.users(user_id),
  due_date DATE,
  status TEXT DEFAULT 'open',      -- open, mitigated, closed, accepted
  source TEXT,                     -- manual, agent_proposed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 012_audit_events.sql  (if not already in 001_init.sql)
CREATE TABLE IF NOT EXISTS mgm.audit_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  request_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Phase 0 — Toolchain Health (2–3 days)

These are blockers. Nothing else should ship until lint and tests pass.

### 0.1 Fix ESLint v9 configs in all three workspaces

ESLint v9 requires a flat config file (`eslint.config.js`). All three workspaces currently fail with "cannot find config." Create `eslint.config.js` (or `.mjs`) in `backend/`, `frontend/`, and `mobile/` using `@typescript-eslint/eslint-plugin` flat config format.

```js
// backend/eslint.config.js (example)
import tseslint from "typescript-eslint";
export default tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: ["dist/**"] }
);
```

### 0.2 Add frontend Vitest setup

`frontend/vitest.config.ts` with jsdom environment. Create at least one smoke test per page component (renders without throwing). Target: every page in `src/pages/` has a `*.test.tsx`.

### 0.3 Fix mobile jest

Add `jest` + `@testing-library/react-native` + `jest-expo` preset to `mobile/devDependencies`. Add `jest.config.js`. Create one smoke test for `DashboardScreen`.

### 0.4 Fix frontend bundle size

649KB is too large. Add `React.lazy()` + `Suspense` code splitting per route in `App.tsx`. Each page should be a dynamic import. Target: initial bundle under 200KB gzip.

**Exit criteria:** `npm run lint` and `npm run test` pass in all three workspaces.

---

## Phase 1 — Frontend MVP: Operational Pages (1.5 weeks)

The `helix-mockup-standalone` is the visual spec. Each page below should match the mockup layout while pulling data from live API endpoints.

**1.1 Overview / KPI Command Surface** (`/dashboard`)

Wire `DashboardPage` to live data. Replace hardcoded cards with API calls.

```ts
// Required API calls
GET /api/v1/incidents?status=open        → count
GET /api/v1/incidents?priority=P1,P2     → count  
GET /api/v1/tac-cases                    → count
GET /api/v1/devices                      → compute health % from status field
GET /api/v1/health                       → source sync status strip
```

Add an activity timeline section (last 10 audit events from `mgm.audit_events`). Add a source sync status bar showing each integration's last sync time and enabled state from `integration_source_configs`. This is the screen every persona sees first — it needs to be functional before UAT.

**1.2 Incidents Page** (`/incidents`)

Extend `IncidentsPage` with: incident detail drawer/modal, status update action (PATCH), TAC case link form, update thread (POST to `/incidents/:id/updates`), P1/P2 visual priority badges. Viewers should see a "My Incidents" filtered view.

**1.3 Devices Page** (`/devices`)

Extend `DevicesPage` with: device detail panel, health status badge, `dna_managed` indicator, serial number lookup that calls `SupportApiClient.getContractBySerial()` via a new `GET /api/v1/devices/:id/contract` route. EoX badge from `SupportApiClient.getEoxByPid()`.

**1.4 Source Admin / Integrations Page** (`/integrations`, `/admin/sources`)

New page. Table of all sources from `GET /api/v1/admin/sources` with enabled toggle, schedule, last sync, and a "Test Now" button that calls `POST /api/v1/admin/sources/:name/test`. Admin role only sees the edit controls; SDM role sees read-only.

**1.5 TAC Cases Page** (`/tac-cases`)

New page. Paginated table from `GET /api/v1/tac-cases`. Link each case to its associated incident if `tac_case_number` matches.

**1.6 Properties Page** (`/properties`)

Extend with property detail view and a user assignment management panel (calls `GET/POST /api/v1/admin/users/:id/properties`). Admin/manager roles only.

**Exit criteria:** Each operational persona (SDM, Engineer, Admin) can complete their BRD day-1 workflow end-to-end in a staging environment.

---

## Phase 2 — Backend: Missing Routes (1 week)

### 2.1 PSIRT / OpenVuln

Create `backend/src/integrations/psirtClient.ts` using the Cisco PSIRT OpenVuln API (`https://apix.cisco.com/security/advisories/`). OAuth2 client credentials, same pattern as `SupportApiClient`. 

Routes: `GET /api/v1/security/advisories` (paginated list with severity filter) and `GET /api/v1/security/advisories/:advisoryId`. Add to `integration_source_configs` seed as Wave 14 and to `syncHandlers`.

Migration: `004_psirt_advisories.sql` (above).

### 2.2 Field Notices

Create `backend/src/integrations/fieldNoticesClient.ts` using the Cisco Field Notices API. Routes: `GET /api/v1/field-notices` and `GET /api/v1/field-notices/:fnId`. Add device-to-notice matching route: `GET /api/v1/devices/:id/field-notices` (joins `device_field_notices`).

Migration: `005_field_notices.sql` (above).

### 2.3 Customer Health Score API

Route: `GET /api/v1/properties/:id/health` computes a score on demand from: open incident count, P1 active flag, TAC cases, device health %, latest VoC signal. Also `GET /api/v1/health-scores` for portfolio view (admin/sdm only). This is the foundation Agents 4, 5, 7, and 20 depend on.

Migration: `007_customer_health.sql` (above).

### 2.4 SLA Tracking Routes

Routes: `GET /api/v1/sla/contracts` and `POST /api/v1/sla/contracts` for SLA definition. `GET /api/v1/incidents/:id/sla` returns elapsed time vs. SLA window for a specific incident, with `alert_pct` (50/75/90). Background job that runs every 5 minutes to update `incident_sla_tracking`.

Migration: `006_sla_contracts.sql` (above).

### 2.5 VoC Signal Ingestion

Route: `POST /api/v1/voc/signals` for manual or webhook-based signal push. `GET /api/v1/voc/signals?propertyId=&limit=` for retrieval. Minimal sentiment classification by score range (negative < 3, neutral 3–4, positive > 4 on 5-point scale).

Migration: `008_voc_signals.sql` (above).

### 2.6 RAID Log Routes

`GET/POST /api/v1/raid` and `PATCH /api/v1/raid/:entryId`. Requires `admin`, `sdm`, or `manager`. This is the data store Agent 9 writes to.

Migration: `011_raid_log.sql` (above).

### 2.7 Post-Incident Doc Routes

`GET /api/v1/incidents/:id/post-incident-doc` and `PUT /api/v1/incidents/:id/post-incident-doc`. The PUT is called by Agent 10 after it assembles the document. The GET is for the SDM review step.

Migration: `010_post_incident_docs.sql` (above).

---

## Phase 3 — Frontend MVP: Experience Pages (1.5 weeks)

**3.1 Security / PSIRT Page** (`/security`)

Table of advisories from `GET /api/v1/security/advisories`, sorted by CVSS score descending. Filter by severity (Critical/High/Medium). For each device with a matching affected product, surface a badge in the Devices page. Cross-link to device detail.

**3.2 Field Notices Page** (`/field-notices`)

Table of field notices. Each row expands to show matched devices. Pull from `GET /api/v1/field-notices`. Match count badge in the Devices page.

**3.3 Sentiment / VoC Page** (`/sentiment`)

KPI strip: CSAT, NPS, at-risk journey count, VoC pipeline lag. Signal list from `GET /api/v1/voc/signals`. Negative sentiment signals surface in red with property attribution. Chart: rolling 90-day NPS trend (recharts). This page feeds the "Customer Impact" segment of the leadership walkthrough.

**3.4 Journey Views** (`/journeys`)

Property selector → active journey stage display (Evaluate / Commit / Implement / Optimize). Integration wave alignment per stage using the source registry. Progress bars by phase. This is mostly frontend layout — the data comes from `journey_stages` and `integration_source_configs`.

**3.5 Experience Command** (`/cx-command`)

Cross-property customer health table (scores from `GET /api/v1/health-scores`). Renewal risk indicators. Financial summary stub (Salesforce-backed). This page is the PM/CXM/Leadership view the walkthrough script demos as "Business Outcomes."

**3.6 SDC Personas Console** (`/console`)

Role-aware landing that renders the right "recommended next steps" panel depending on `req.auth.role`. SDM sees incident queue + SLA alerts. Engineer sees device health + PSIRT matches. PM sees journey stage + Salesforce opportunities. CXM sees VoC + health scores. Admin sees source health. This is the "single view" the BRD targets as its north-star outcome.

**Exit criteria:** Leadership walkthrough script (18 minutes, 5 segments from the Exec doc) can be run end-to-end in staging.

---

## Phase 4 — Agentic Infrastructure (1 week) — ✅ DONE (verified 2026-07-09)

This phase installs the plumbing all 20 agents share. **Built, not planned** — see file-by-file notes below; original plan text kept for reference on intended design vs. what actually shipped.

### 4.1 Add BullMQ + Anthropic SDK — ✅ done, partially wired

`backend/src/jobs/queue.ts` has real BullMQ/Redis queue scaffolding, but no worker processors
consume it yet — the 4 live agents dispatch via cron in `jobs/scheduler.ts` directly, bypassing
the queue entirely. Original plan text below for reference:

```json
// backend/package.json additions
"@anthropic-ai/sdk": "^0.36.0",
"bullmq": "^5.0.0"
```

Create `backend/src/queue.ts`:
```ts
import { Queue, Worker } from "bullmq";
import { redis } from "./redis.js";

export const agentQueue = new Queue("agent-jobs", { connection: redis });
export function createWorker(name: string, processor: ...) { ... }
```

### 4.2 Create Agent Base Class — ✅ done, matches plan almost exactly

`backend/src/agents/base.ts` really does define the Observe / Reason / Act / Report pattern below,
with approval persistence to `mgm.agent_jobs`/`mgm.agent_approvals`:

```ts
export abstract class BaseAgent {
  abstract name: string;
  abstract observe(): Promise<AgentContext>;
  abstract reason(ctx: AgentContext): Promise<AgentDecision>;
  abstract act(decision: AgentDecision): Promise<AgentResult>;
  
  async run(): Promise<AgentResult> {
    const ctx = await this.observe();
    const decision = await this.reason(ctx);
    if (decision.requiresHumanApproval) {
      await this.requestApproval(decision); // all customer-facing actions gate here
      return { status: "pending_approval", decision };
    }
    return this.act(decision);
  }
}
```

### 4.3 LLM Client Wrapper — ✅ done, different path than planned

Built at **`backend/src/agents/llm.ts`** (plan said `integrations/llmClient.ts`) — wraps
`@anthropic-ai/sdk` (`llm()`/`llmJson()` for structured output), hardcoded to
`claude-3-5-sonnet-20241022` for all calls. **Gap vs. plan:** no cost-aware model routing
(Haiku/Sonnet/Opus tiering per task) yet — every agent call uses the same model regardless of task
complexity.

### 4.4 Human Approval Gate — ✅ done, at `routes/agents.ts` not `agentApprovals.ts`

`backend/src/routes/agents.ts` exposes `/status`, `/approvals`, `/run` — approval state persists to
`mgm.agent_approvals` as planned. Endpoint path differs from the original plan (single `agents.ts`
route file, not a separate `agentApprovals.ts`), functionally equivalent.

### 4.5 Config

Add to `config.ts`:
```ts
ANTHROPIC_API_KEY: z.string().optional().default(""),
LLM_MODEL_FAST: z.string().default("claude-haiku-4-5-20251001"),
LLM_MODEL_DEFAULT: z.string().default("claude-sonnet-4-6"),
WEBEX_BOT_TOKEN: z.string().optional().default("") // already present
```

**Exit criteria:** A test agent that observes open incidents, calls the LLM to write a one-sentence summary, and posts the result to the approvals queue passes with a mock LLM response.

---

## Phase 5 — Tier 1 Agents: Quick Wins (3–4 weeks) — ✅ ALL 4 DONE (verified 2026-07-09)

Target: 200+ hours/year recovered per SDM. Zero new external integrations required — all data is already in the platform.

**All four agents below exist** as `backend/src/agents/statusReport.ts`, `incidentFirstResponse.ts`,
`slaMonitor.ts`, and `postIncidentDoc.ts` — registered and scheduled via cron in `jobs/scheduler.ts`
(SLA Monitor `*/15`, Incident First-Response `*/5`, Status Report weekly, PID hourly). Not verified
in this pass: whether each one's *behavior* matches every detail below (e.g. the 60-second P1
response SLA, the 2-minute auto-approve rule) — only that the scheduled jobs and routes are real,
not stubs. Worth a follow-up behavioral check before calling Phase 5 fully closed.

**Agent 1 — Automated Status Report Agent** (SDM/PM/PgM · V.HIGH impact)

Scheduled BullMQ job (weekly, Monday 8AM). Observes: open incident count, P1 count, TAC cases, device health %, source sync status, MTTR from last 7 days. Calls LLM (Sonnet) to write executive narrative trend commentary. Populates a status report template. Posts to agent approvals queue for 10-minute human review. On approval: sends via Webex bot to configured channel.

New route: `POST /api/v1/agents/status-report/trigger` (admin/sdm only, manual trigger for testing).

**Agent 2 — Incident First-Response & Comms Agent** (SDM/HTOM · HIGH impact)

Webhook trigger: incident created with P1 or P2 priority. Within 60 seconds: classify severity from metadata, fetch property/account context, generate branded customer notification (LLM, Haiku model — fast), create Webex room if P1, set update cadence worker (BullMQ delayed job every 30 min until resolution). All notifications pass through approval gate with 2-minute auto-approve for P1 if no human response.

Backend: webhook listener inside `incidentsRouter.post("/")` that enqueues `incident-first-response` BullMQ job.

**Agent 8 — SLA Compliance Monitoring Agent** (SDM/HTOM · HIGH impact)

BullMQ repeating job every 5 minutes. Queries `incident_sla_tracking`. For each incident at 50/75/90% of SLA window elapsed, writes to `incident_sla_tracking.last_alert_pct` and triggers a Webex notification to the assigned SDM with escalation path recommendation. Monthly compliance report generated on the 1st of each month.

No LLM required — this is purely computational. Most reliable agent in the portfolio.

Frontend: SLA status badges on the Incidents page using the `GET /api/v1/incidents/:id/sla` route from Phase 2.

**Agent 10 — Post-Incident Documentation Agent** (SDM/HTOM · HIGH impact)

Trigger: incident status changes to `resolved` or `closed`. Queries the incident's full lifecycle: creation event, all updates, TAC case linkage, device associations, timeline of status changes from audit log. Calls LLM (Sonnet) to generate structured post-incident report (root cause, timeline, contributing systems, prevention steps). Stores in `post_incident_docs`. Routes to SDM for 5-minute review via approval gate. On approval: optionally writes a KB article tag to the incident.

This directly addresses the BRD's auditability requirement and the Helix framework's "documentation: 2 hrs → <5 min" target.

**Exit criteria for Phase 5:** Run a P1 incident drill in staging. Within 60 seconds, a draft customer notification appears in the approval queue. Upon incident resolution, a post-incident doc is auto-drafted and available for SDM review.

---

## Phase 6 — Tier 2 Agents: Operational Excellence (4–5 weeks)

Target: proactive operating model for SDM, engineer, and PM roles.

**Agent 6 — Meeting Intelligence & Action Capture** (All roles · V.HIGH)

Webex API integration: subscribe to meeting-ended webhook. Fetch transcript. LLM (Sonnet) extracts action items with owner identity, due date, and priority. Creates tasks as RAID log entries or incident updates depending on context. Sends personalized follow-up digest to each participant within 5 minutes listing only their action items.

Prerequisite: Webex Bot Token configured (`WEBEX_BOT_TOKEN`).

**Agent 7 — Escalation Prediction Agent** (SDM/HTOM/PgM · HIGH)

BullMQ repeating job every hour. Monitors 8 escalation signals per property: incident age vs. average, reopen rate, VoC sentiment trend, SLA pressure index, communication frequency delta, stakeholder access pattern. Composite risk score computed. Properties above threshold alert SDM with specific contributing signals and recommended intervention. 

Depends on: VoC signals (Phase 2.5), SLA tracking (Phase 2.4), customer health scores (Phase 2.3).

**Agent 9 — RAID Log Maintenance Agent** (PM/PgM · HIGH)

Processes Webex meeting transcripts (from Agent 6 output) and incident update threads. LLM identifies and proposes new RAID entries. Stages them for PM approval before writing to `mgm.raid_log`. Weekly health digest to PM flagging top 3 overdue mitigations.

Depends on: Agent 6 (transcript data), RAID routes (Phase 2.6).

**Agent 3 — QBR/EBR Content Assembly Agent** (CSM/SDM/PgM · V.HIGH)

Triggered 30 days before a configured QBR date (stored in a new `mgm.qbr_schedule` table). LangChain-style multi-hop chain: fetch Salesforce account data → fetch 12 weeks of incident metrics → fetch device health trends → fetch VoC signals → fetch smart licensing status → LLM (Opus) synthesizes trend narrative and populates QBR slide template. Output: a structured JSON document posted to approval queue. On approval: generates PPTX via the existing `pptx` skill pattern.

This is the highest hours-recovered agent: 4–6 hrs → 30 min per account per quarter.

**Agent 11 — Customer Onboarding Orchestration Agent** (PM/CSM · HIGH)

Triggered by a new property being marked `status = onboarding` (new status enum value). Monitors integration source configs for that property — when each wave goes `enabled = true`, sends a proactive milestone notification via Webex. Detects delays when a wave's scheduled date passes without enablement. Generates onboarding completion report at 100% wave enablement.

**Exit criteria for Phase 6:** A simulated QBR prep run produces a draft PPTX with real data for a test property within 30 minutes of trigger.

---

## Phase 7 — Tier 3 Agents: Customer Experience (4 weeks)

**Agent 4 — Customer Health Scoring Agent** (CSM/HTOM · HIGH, Foundation Agent)

BullMQ polling every 15 minutes per property. Aggregates: case volume/severity, device health %, SLA compliance rate, sentiment score, escalation history. Writes composite score (0–100) to `customer_health_scores`. Alerts CSM when score drops below threshold (configurable, default 60). This is a prerequisite for Agents 5, 7, 14, and 20.

**Agent 5 — Renewal Risk Early Warning Agent** (CSM/PgM · HIGH)

Runs daily. Reads Salesforce opportunity close dates. For accounts within 180 days of renewal, computes risk score from 15 signals: health score trend, VoC sentiment, smart licensing gap, support burden, stakeholder access. Generates ranked at-risk account list with intervention playbook per account. Daily digest to CSM/PgM.

Depends on: Agent 4 (health scores), Salesforce routes (Phase 1 completion), VoC signals.

**Agent 12 — Executive Communications Drafting Agent** (CSM/PgM · HIGH)

On demand via `POST /api/v1/agents/exec-comms/draft` with `{recipientRole, keyPoints[], desiredOutcome, accountContext}`. LLM (Sonnet) generates a tone-calibrated draft appropriate for the recipient seniority. Returns draft with reasoning commentary for 5-minute review. Not scheduled — invoked by the SDC Personas Console "Draft Exec Comm" action.

**Agent 15 — Change Impact & Communication Agent** (PM/SDM/HTOM · HIGH)

Triggered by `POST /api/v1/incidents` or a new integration wave enablement. Maps affected properties, devices, and user roles. LLM generates audience-tailored communications for each stakeholder group (technical, business, executive). Manages approval workflow with automated reminders at 24h and 48h. Depends on device inventory and property data already in the platform.

**Agent 13 — Adoption & Utilization Gap Agent** (CSM · MEDIUM)

Weekly job. Compares Smart Licensing entitlements (from `cisco.smart_licenses`) to active device count per product family (from `mgm.devices`). Identifies properties with large gaps. Generates personalized engagement playbook per account. Surfaces upsell signals.

**Exit criteria for Phase 7:** Health score dashboard in Experience Command page shows live scores for all properties. Renewal risk list surfaces at least one at-risk property from test Salesforce data.

---

## Phase 8 — Tier 4 Agents: Portfolio Intelligence (4–5 weeks)

Prerequisite: Agents 4, 5, 7, 8 must be live and producing data.

**Agent 14 — VoC Synthesis & Trend Agent** (CSM/HTOM/PgM · MEDIUM)

Continuous ingestion from `voc_signals`. LLM sentiment classification on case notes and transcript excerpts. Time-series aggregation per property and portfolio. Sudden negative shift detection triggers immediate alert. Feeds the Sentiment/VoC page in real time.

**Agent 16 — Resource Utilization Agent** (PM/PgM/SDM · MEDIUM)

Monitors user workload via incident assignment distribution and open RAID items. Flags engineers with >80% of P1/P2 incidents in a rolling window. Surfaces demand peaks. Depends on user assignment data already in the platform (no external time-tracking needed for MVP).

**Agent 18 — Financial Forecast Agent** (PgM · MEDIUM)

Weekly job. Pulls Salesforce pipeline data, Smart Licensing entitlements, and renewal dates. Generates 90-day revenue forecast. Alerts on margin risk signals (license gaps, at-risk renewals). Powers the financial table in Experience Command.

**Agent 19 — Delivery Performance Benchmarking Agent** (PgM/HTOM · MEDIUM)

Monthly job. Computes MTTR, SLA compliance %, on-time sync %, and CSAT across all properties. Z-score outlier detection. Generates league table. Surfaces best practices from top-performing properties.

**Agent 20 — Multi-Account Portfolio Intelligence Briefing** (PgM/CSM · MEDIUM, Capstone)

Daily at 7:00 AM. Aggregates live outputs from Agents 4, 5, 7, 8, and 18. LangChain synthesis chain: health distribution, top 3 escalation risks, renewal pipeline, SLA pressure, one recommended action. Personalized delivery per PgM/CSM user via Webex. This is the capstone — it amplifies every agent before it.

**Exit criteria for Phase 8:** PgM receives a daily portfolio briefing Webex message before 7:30 AM with accurate data for ≥3 test properties.

---

## Integration Waves to Complete

The source registry already has 18+ wave configs. The following need client implementations added to `syncHandlers`:

| Wave | Source | Client Status | Priority |
| --- | --- | --- | --- |
| W14 | psirt-openvuln | ❌ Needs client (env vars already documented in `.env.example`) | High (Phase 2.1) |
| W15 | field-notices | ❌ Needs client (env vars already documented in `.env.example`) | High (Phase 2.2) |
| W4 | webex | ⚠️ Client exists (`webexClient.ts`), wired to `routes/integrations.ts` war-room creation — **not** on the cron sync system, mockup still flags it off | Correct status flags; decide if war-room-only scope is sufficient for W4 |
| W4 | support-api | ⚠️ Client built (`supportApiClient.ts`, real Coverage/EoX/Bug endpoints) but **zero imports anywhere in `backend/src`** — dead code, not "Done" | High — wire into a route/job or the work was wasted |
| W5 | thousandeyes | ❌ Stub — no client, no env vars (never started) | Medium |
| W6 | umbrella | ❌ Stub — no client, no env vars (never started) | Medium |
| W7 | stealthwatch | ❌ Stub — no client, no env vars (never started) | Low |
| W8 | dwdm | ❌ Stub — no client, no env vars (never started) | Low |
| W9 | cisco-iq | ❌ Stub — no client, no env vars (never started) | Low |
| W10 | cspc | ❌ Stub — no client, no env vars (never started) | Low |
| W11 | ise | ❌ Stub — no client, no env vars (never started) | Low |
| W12 | cisco-spaces | ❌ Stub — no client, no env vars (never started) | Low |
| W13 | secure-access | ❌ Stub — no client, no env vars (never started) | Low |
| W16 | fmc | ❌ Stub — **but seeded `enabled: true` in `sourceAdmin.ts` and flagged "on" in the mockup** — actively misrepresents this integration as live | **Urgent** — fix the flag before anyone relies on it, then build the client |
| W17 | salesforce | ✅ Done (`salesforceClient.ts` + `routes/salesforce.ts` + sync handler) — **but seeded `enabled: false` and missing from the mockup's `INTEGRATION_SOURCES` array** | Cheap fix — flip the flags to match reality |

---

## Mobile App Completion

The mobile app (Expo) has screens for Dashboard, Incidents, Devices, Properties, Salesforce, Console, and Settings — matching the React app's scope. Current gaps:

- No `eslint.config.js` — add flat config targeting `@typescript-eslint`
- No jest config — add `jest-expo` preset and `@testing-library/react-native`
- All screens likely have hardcoded data like the web app
- `expo-secure-store` is installed (good) but token storage needs to be wired to the same auth flow as the web frontend
- SSO via `expo-auth-session` is set up in dependencies but likely not wired

Priority order: fix toolchain → wire auth → wire real API calls per screen → match web app parity. Mobile is not blocking MVP but should reach parity by Phase 3.

---

## Non-Functional Requirements Checklist

| NFR | Target | Current State | When to Address |
| --- | --- | --- | --- |
| Performance P95 <1.5s | Dashboard endpoints | Not measured | Phase 1 — add response time logging |
| Availability 99.5% | Business hours | Docker Compose only | Phase 4 — add process supervision |
| Auditability | All mutations | Audit middleware exists, table schema pending | Phase 2 (migration 012) |
| Data freshness | Sync timestamps visible | `updated_at` on source configs | Phase 1 (Source Admin page) |
| ESLint/Typecheck pass | All workspaces | 3 workspaces failing lint | Phase 0 |
| Frontend tests | Key route coverage | Zero test files | Phase 0 |
| Code splitting | Initial bundle <200KB | 649KB gzip | Phase 0 |
| CORS production config | Non-localhost origins | Defaulting to localhost | Before any staging deploy |

---

## Work Sizing Summary

| Phase | What | Effort |
| --- | --- | --- |
| 0 | Toolchain: ESLint, tests, bundle splitting | 2–3 days |
| 1 | Frontend operational pages (Overview, Incidents, Devices, Sources, TAC, Properties) | 1.5 weeks |
| 2 | Backend missing routes (PSIRT, Field Notices, Health, SLA, VoC, RAID, PIR docs) + 9 migrations | 1 week |
| 3 | Frontend experience pages (Security, Field Notices, Sentiment, Journey, CX Command, Personas) | 1.5 weeks |
| 4 | ~~Agentic infrastructure (BullMQ, Anthropic SDK, base class, approval gate)~~ | ✅ Done — 0 (queue→worker wiring still open, see gap table above) |
| 5 | ~~Tier 1 agents (Status Report, Incident Comms, SLA Monitor, Post-Incident Docs)~~ | ✅ Done — 0 (behavioral spec-conformance not re-verified) |
| 6 | Tier 2 agents (Meeting Intel, Escalation Predict, RAID, QBR Assembly, Onboarding) | 4–5 weeks |
| 7 | Tier 3 agents (Health Score, Renewal Risk, Exec Comms, Change Impact, Adoption) | 4 weeks |
| 8 | Tier 4 agents (VoC Synthesis, Resource Util, Financial Forecast, Benchmarking, Portfolio Brief) | 4–5 weeks |
| — | Mobile parity | Parallel to Phases 1–3 |
| **Total (remaining, as of 2026-07-09)** | | **~15–18 weeks** (was ~22–27; Phases 4–5 came in already done) |

Phases 0–3 deliver the BRD MVP. Phases 4–8 deliver the full Helix Agentic Framework — **4 and 5 are
now done**, so the agentic framework's remaining work is Phases 6–8 (16 of 20 agents).

---

## Recommended Build Order (Next 4 Weeks)

If you want to reach BRD UAT sign-off as fast as possible:

1. **Week 1:** Phase 0 (toolchain) + start Phase 2 migrations + wire DashboardPage to live data
2. **Week 2:** Phase 1 (Incidents detail, Devices detail, Source Admin page, TAC page)
3. **Week 3:** Phase 2 backend routes (PSIRT, Field Notices, Health, SLA) + Phase 3 Security/Field Notices pages
4. **Week 4:** Phase 3 Sentiment + Experience Command + Personas Console → leadership walkthrough rehearsal

That gets the 18-minute executive walkthrough fully demoed with live data in 4 weeks.

---

Document classification: Internal Engineering · ServiceFlow SDM Program
