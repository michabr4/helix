# Helix — Requirements Document

> **Version:** 1.0  
> **Date:** 2026-04-06  
> **Status:** Derived from existing build (MVP)  
> **Audience:** Engineering, product, delivery leads, QA, security review

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Stakeholders and personas](#2-stakeholders-and-personas)
3. [System architecture](#3-system-architecture)
4. [Authentication and authorization](#4-authentication-and-authorization)
5. [Database requirements](#5-database-requirements)
6. [Backend API requirements](#6-backend-api-requirements)
7. [External integration requirements](#7-external-integration-requirements)
8. [Frontend application requirements](#8-frontend-application-requirements)
9. [Mockup hub requirements](#9-mockup-hub-requirements)
10. [Digitized Delivery requirements](#10-digitized-delivery-requirements)
11. [Salesforce CRM integration requirements](#11-salesforce-crm-integration-requirements)
12. [Infrastructure and deployment](#12-infrastructure-and-deployment)
13. [Security requirements](#13-security-requirements)
14. [Observability and audit](#14-observability-and-audit)
15. [Non-functional requirements](#15-non-functional-requirements)
16. [Out of scope (MVP)](#16-out-of-scope-mvp)
17. [Milestones and definition of done](#17-milestones-and-definition-of-done)
18. [Appendix A — Environment variables](#appendix-a--environment-variables)
19. [Appendix B — Database schema](#appendix-b--database-schema)
20. [Appendix C — API route inventory](#appendix-c--api-route-inventory)

---

## 1. Product overview

**Helix** (Service Delivery Manager) is a full-stack platform for Cisco-powered enterprise service delivery operations targeting the hospitality vertical (MGM Resorts reference implementation). It unifies 17+ Cisco integration waves, Salesforce CRM, Digitized Delivery automation (Network as Code, Services as Code, Digital Document Solutions), and six SDC program consoles (PM, Service Delivery, Success, Renewals, Delivery Architect, Engineer) into a single operational surface.

### 1.1 Core value propositions

- **Single pane of glass** for multi-vendor, multi-domain service delivery across properties
- **Cisco API consolidation** — Waves 1–17 covering DNA Center, TAC, Smart Licensing, WebEx, ThousandEyes, Umbrella, Stealthwatch, DWDM, Cisco IQ, CSPC, ISE, Cisco Spaces, Secure Access, PSIRT/OpenVuln, Field Notices, FMC, and Salesforce CRM
- **Digitized Delivery** — NaC (9 solutions), SaC (12 waves A–J + AI Assistant + DDS), with ROI calculators and automation readiness scoring
- **SDC console parity** — replaces swivel-chair across vendor consoles with unified API-driven views
- **AI copilot integration** — context-rich prompt blocks for Microsoft 365 Copilot per view
- **Role-based experience** — each persona (PM, SDM, CXM, CDA, Engineer, HTOM) sees prioritized data

### 1.2 System components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend API | Express.js + TypeScript | REST API, auth, integrations, business logic |
| Frontend SPA | React 18 + MUI v6 + Vite | Authenticated operational dashboard |
| Mockup hub | Static HTML/CSS/JS | 19-view interactive prototype with live data mode |
| Database | PostgreSQL 15 | Persistent storage (schemas: `mgm`, `cisco`, `audit`) |
| Cache | Redis 7 | Session/cache layer (connected at startup) |
| External APIs | Cisco, Salesforce, Microsoft, WebEx | Integration sources |

---

## 2. Stakeholders and personas

### 2.1 Application roles (RBAC)

| Role | Access level | Primary use cases |
|------|-------------|-------------------|
| `admin` | Full access | System configuration, user management, all operations |
| `sdm` | Delivery operations | Incident management, device operations, source admin, sync |
| `tam` | Technical advisory | Incident triage, TAC linkage, source testing, sync |
| `csm` | Customer success | Read access, Salesforce case creation |
| `engineer` | Technical execution | Device management, incident updates, Salesforce read |
| `manager` | Program oversight | Properties, source admin, sync, Salesforce write |
| `viewer` | Read-only | Dashboard viewing, Salesforce read |

### 2.2 SDC program consoles (mapped to views)

| Console | Primary persona(s) | Key data sources |
|---------|-------------------|-----------------|
| PM Console | PM, Manager | Salesforce Accounts + Opportunities, wave maturity, properties |
| Service Delivery Console | SDM, Engineer | Incidents, TAC SRs, Salesforce Cases, device health |
| Success Console | CXM, CSM | Salesforce Entitlements + Account health, adoption metrics |
| Renewals Console | CXM, Manager | Salesforce Opportunities + Service Contracts, pipeline |
| Delivery Architect Console | CDA | NaC/SaC architecture patterns, reference designs |
| Engineer Console | Engineer | Device operations, NaC pipelines, FMC/ISE config |

---

## 3. System architecture

### 3.1 Runtime topology

```
Browser ─── React SPA (:3001) ───┐
                                  ├── Express API (:3000) ── PostgreSQL (:5432)
Browser ─── Mockup Hub (:3000) ──┘                      └── Redis (:6379)
                                                          └── Cisco APIs (external)
                                                          └── Salesforce REST (external)
                                                          └── Microsoft Graph (Power BI)
                                                          └── WebEx APIs (external)
```

### 3.2 Backend middleware stack (ordered)

1. **Helmet** (path-based CSP via `helmetByPath`)
2. **CORS** (from `CORS_ORIGIN`, credentials enabled)
3. **Cookie parser** (signed with `JWT_SECRET`)
4. **JSON body parser** (1 MB limit)
5. **Static file server** (`public/` directory)

### 3.3 Route mount map

| Mount path | Router | Source |
|------------|--------|--------|
| `/api/v1/health` | `healthRouter` | `routes/health.ts` |
| `/api/v1/auth` | `authRouter` | `routes/auth.ts` + `routes/sso.ts` |
| `/api/v1/properties` | `propertiesRouter` | `routes/properties.ts` |
| `/api/v1/devices` | `devicesRouter` | `routes/devices.ts` |
| `/api/v1/incidents` | `incidentsRouter` | `routes/incidents.ts` |
| `/api/v1/tac-cases` | `tacRouter` | `routes/tac.ts` |
| `/api/v1/integrations` | `integrationsRouter` | `routes/integrations.ts` |
| `/api/v1/admin` | `sourceAdminRouter` | `routes/sourceAdmin.ts` |
| `/api/v1/analytics/powerbi` | `powerBiRouter` | `routes/powerBi.ts` |
| `/api/v1/salesforce` | `salesforceRouter` | `routes/salesforce.ts` |

---

## 4. Authentication and authorization

### 4.1 Local authentication (JWT)

| Requirement | Detail |
|-------------|--------|
| **REQ-AUTH-001** | Users authenticate via `POST /api/v1/auth/login` with email + password |
| **REQ-AUTH-002** | Passwords validated with bcrypt; generic "Invalid username or password" on failure |
| **REQ-AUTH-003** | On success, API returns `accessToken` (JWT, default 24h) and `refreshToken` (default 7d) |
| **REQ-AUTH-004** | JWT signed with `JWT_SECRET` (minimum 32 characters); payload contains `userId` (UUID) and `role` |
| **REQ-AUTH-005** | Token refresh via `POST /api/v1/auth/refresh` with valid refresh token |
| **REQ-AUTH-006** | Logout via `POST /api/v1/auth/logout` (authenticated, returns 204) |
| **REQ-AUTH-007** | All protected routes require `Authorization: Bearer <token>` header |
| **REQ-AUTH-008** | Role-based access enforced via `requireRoles([...])` middleware; returns 403 on mismatch |

### 4.2 SSO / OIDC authentication (optional)

| Requirement | Detail |
|-------------|--------|
| **REQ-SSO-001** | OIDC SSO enabled via `SSO_ENABLED=true` with issuer discovery |
| **REQ-SSO-002** | Authorization Code flow with PKCE; state stored in signed httpOnly cookie |
| **REQ-SSO-003** | Callback matches user by email in `mgm.users`; returns 403 if no matching account |
| **REQ-SSO-004** | Optional JIT provisioning via `SSO_JIT_DEFAULT_ROLE` (creates user with bcrypt-hashed random password) |
| **REQ-SSO-005** | On success, redirects to `SSO_SUCCESS_REDIRECT` with tokens in URL hash fragment |
| **REQ-SSO-006** | Cross-field validation: when SSO is enabled, issuer, client ID, and redirect URI are required |

### 4.3 Seed users (development)

| Email | Role | Default password |
|-------|------|-----------------|
| `admin@serviceflow.local` | `admin` | `ChangeMe123!` |
| `sdm@serviceflow.local` | `sdm` | `ChangeMe123!` |
| `engineer@serviceflow.local` | `engineer` | `ChangeMe123!` |

---

## 5. Database requirements

### 5.1 PostgreSQL configuration

| Requirement | Detail |
|-------------|--------|
| **REQ-DB-001** | PostgreSQL 15+ with extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm` |
| **REQ-DB-002** | Three schemas: `mgm` (application), `cisco` (vendor), `audit` (activity logging) |
| **REQ-DB-003** | Connection pool max 10 connections via `pg.Pool` |
| **REQ-DB-004** | Migration via `infra/migrations/001_init.sql`; seed via `infra/seeds/001_seed.sql` |

### 5.2 Core tables

| Schema | Table | Purpose | Key columns |
|--------|-------|---------|-------------|
| `mgm` | `users` | User accounts and RBAC | `user_id` (UUID), `email` (unique), `role` (enum), `password_hash` |
| `mgm` | `properties` | Managed properties/sites | `property_id` (UUID), `name`, `property_type` (hotel/casino/resort/venue) |
| `mgm` | `devices` | Network device inventory | `device_id` (UUID), `property_id` (FK), `hostname`, `ip_address` (INET), `serial_number`, `status` (enum), `dna_device_id`, `dna_managed`, `health_score` |
| `mgm` | `incidents` | Incident lifecycle | `incident_id` (UUID), `incident_number` (sequence), `priority` (P1-P4), `status` (8-value enum), `tac_case_number`, `tac_severity` |
| `mgm` | `incident_updates` | Incident timeline entries | `update_id`, `incident_id` (FK), `user_id` (FK), `content` |
| `cisco` | `tac_cases` | TAC service request sync | `tac_case_id` (UUID), `case_number` (unique), `severity` (1-4), `status`, `incident_id` (FK) |
| `cisco` | `technologies` | Technology catalog | `tech_id`, `name`, `category`, `vendor` |
| `cisco` | `licenses` | License inventory | `license_id`, `tech_id` (FK), `type`, `quantity`, `expiry` |
| `audit` | `activity_log` | Audit trail | `log_id`, `event_type`, `user_id`, `ip_address`, `user_agent`, `metadata` (JSONB), `created_at` |
| `mgm` | `integration_source_configs` | Integration source registry (runtime-created) | `source_name` (PK), `enabled`, `base_url`, `auth_type`, `schedule`, `credentials_ref`, `notes` |

### 5.3 Additional tables

`mgm.property_technology_adoption`, `mgm.adoption_history`, `mgm.property_license_usage`, `mgm.sla_metrics`, `mgm.changes`, `mgm.teams_channels`, `mgm.webex_spaces`, `mgm.notifications`, `mgm.dashboards`, `mgm.reports`, `mgm.report_history`, `cisco.license_history`, `cisco.tac_case_updates`

### 5.4 Sequences and triggers

- `mgm.incident_number_seq` — auto-generates `INC-NNNNN` on incident insert
- `mgm.change_number_seq` — auto-generates change numbers
- Resolution time trigger on incident status → `resolved`/`closed`
- `updated_at` auto-update triggers on major tables

---

## 6. Backend API requirements

### 6.1 Health check

| ID | Method | Path | Auth | Description |
|----|--------|------|------|-------------|
| **REQ-API-001** | GET | `/api/v1/health` | None | Returns `{ status: "ok" }` after `SELECT 1` on database pool |

### 6.2 Properties

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-010** | GET | `/api/v1/properties` | Bearer | Any | List all properties with `property_id`, `name`, `property_type` |
| **REQ-API-011** | POST | `/api/v1/properties` | Bearer | admin, sdm, manager | Create property; body: `name` (min 1), `propertyType` (enum); audit logged |

### 6.3 Devices

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-020** | GET | `/api/v1/devices` | Bearer | Any | List all devices with inventory fields |
| **REQ-API-021** | POST | `/api/v1/devices` | Bearer | admin, sdm, engineer, manager | Create device; body: `propertyId` (UUID), `hostname`, `ipAddress` (IP), `serialNumber` (min 3), `status` (enum); audit logged |

### 6.4 Incidents

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-030** | GET | `/api/v1/incidents` | Bearer | Any | List all incidents with full fields |
| **REQ-API-031** | POST | `/api/v1/incidents` | Bearer | admin, sdm, tam, csm, engineer, manager | Create incident; body: `propertyId`, optional `deviceId`, `title` (min 5), `description` (min 5), `priority` (P1-P4); auto-generates incident number; audit logged |
| **REQ-API-032** | PATCH | `/api/v1/incidents/:id` | Bearer | admin, sdm, tam, engineer, manager | Update incident status (8-value enum); audit logged |
| **REQ-API-033** | POST | `/api/v1/incidents/:id/updates` | Bearer | Any authenticated | Add timeline update; body: `content` (min 1); audit logged |
| **REQ-API-034** | POST | `/api/v1/incidents/:id/tac-link` | Bearer | admin, sdm, tam, engineer | Link TAC case; body: `tacCaseNumber` (min 3), `tacSeverity` (1-4); audit logged |

### 6.5 TAC cases

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-040** | GET | `/api/v1/tac-cases` | Bearer | Any | List synced TAC cases from `cisco.tac_cases` |

### 6.6 Integrations

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-050** | POST | `/api/v1/integrations/webex/war-room` | Bearer | admin, sdm, tam, manager, engineer | Create WebEx space; body: optional `title` (max 200); returns `roomId`, `title`, `webUrl` |
| **REQ-API-051** | POST | `/api/v1/integrations/sync/:source` | Bearer | admin, sdm, tam, manager | Trigger sync for `dna-center`, `tac`, `smart-licensing`, or `salesforce` |

### 6.7 Source administration

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-060** | GET | `/api/v1/admin/sources` | Bearer | admin, sdm, manager | List all 18 integration source configurations |
| **REQ-API-061** | PUT | `/api/v1/admin/sources/:name` | Bearer | admin, sdm, manager | Update source config; body: `enabled`, `baseUrl`, `authType`, `schedule`, `credentialsRef`, `notes` (all optional) |
| **REQ-API-062** | POST | `/api/v1/admin/sources/:name/test` | Bearer | admin, sdm, tam, manager | Test source connection (runs actual sync/test for dna-center, tac, smart-licensing, salesforce) |

### 6.8 Power BI analytics

| ID | Method | Path | Auth | Roles | Description |
|----|--------|------|------|-------|-------------|
| **REQ-API-070** | GET | `/api/v1/analytics/powerbi/embed` | Bearer | All roles | Returns Power BI embed config when `POWERBI_ENABLED=true`; otherwise `{ enabled: false }` |

### 6.9 Salesforce CRM (see also §11)

Covered in detail in Section 11. Summary: 12 endpoints covering status, 8 object queries (cases, accounts, contacts, opportunities, entitlements, service-contracts, tasks, knowledge), console-summary aggregation, and case create/update.

---

## 7. External integration requirements

### 7.1 Integration wave registry

The system supports 18 named integration sources with the following wave assignments:

| Wave | Source | Auth method | Sync schedule | API |
|------|--------|-------------|---------------|-----|
| 1 | DNA Center (Catalyst Center) | Basic → token | */30 * * * * | REST: inventory, sites, health, issues |
| 2 | TAC Service Requests | API key + secret | */15 * * * * | REST v2: cases, updates |
| 3 | Smart Licensing (SSM) | OAuth2 CC | 0 * * * * | SWAPI: licenses, entitlements |
| 4 | WebEx Control Hub | Bot token | Manual | REST: rooms, spaces, meetings |
| 4 | Support API (Contract/EoX/Bug) | API key + secret | 0 2 * * * | REST: SN2Contract, EoX, Bug |
| 5 | ThousandEyes | API token | */15 * * * * | REST: tests, alerts, metrics |
| 6 | Umbrella | API key + OAuth | 0 * * * * | REST: DNS/SIG policies, reports |
| 7 | Stealthwatch (SNA) | API basic/token | */30 * * * * | REST: flow, security analytics |
| 8 | DWDM/Optical EMS | Collector/EMS | 0 * * * * | Transport health |
| 9 | Cisco IQ | OAuth2/API key | 0 4 * * * | REST: insights, entitlements |
| 10 | CSPC Collector | Collector registration | 0 1 * * * | Collection, inventory, licensing |
| 11 | ISE + ISE as Code | ERS + pxGrid | */30 * * * * | ERS/OpenAPI/pxGrid: identity, posture |
| 12 | Cisco Spaces | OAuth2/API key | 0 * * * * | REST: location analytics |
| 13 | Secure Access | OAuth2 CC | */15 * * * * | REST: SSE/ZTNA policies |
| 14 | PSIRT/OpenVuln | OAuth2 CC | 0 3 * * * | REST: advisories, CVEs |
| 15 | Field Notices | API key/OAuth | 0 4 * * * | REST: FN feed, PID/serial/SW match |
| 16 | FMC (Firepower) | API token/basic | */30 * * * * | REST: FTD inventory, policies |
| 17 | Salesforce CRM | OAuth2 password | */15 * * * * | REST v59.0: Cases, Accounts, etc. |

### 7.2 Implemented integration clients

| Client | File | Status | Methods |
|--------|------|--------|---------|
| `DnaCenterClient` | `integrations/dnaCenterClient.ts` | Active | `listDevices()` → upserts `mgm.devices` |
| `TacClient` | `integrations/tacClient.ts` | Active | `listCases()` → upserts `cisco.tac_cases` |
| `SmartLicensingClient` | `integrations/smartLicensingClient.ts` | Active | `getEntitlements()` → count only |
| `WebexClient` | `integrations/webexClient.ts` | Active | `createRoom(title)` → space creation |
| `SupportApiClient` | `integrations/supportApiClient.ts` | Stub | `getContractBySerial`, `getEoxByPid`, `getBugById` → null |
| `SalesforceClient` | `integrations/salesforceClient.ts` | Active | Full CRUD (see §11) |

### 7.3 Sync jobs

| Job | Trigger | Behavior |
|-----|---------|----------|
| DNA Center sync | `POST /sync/dna-center` | Fetches devices, upserts into `mgm.devices` with `dna_managed=true` |
| TAC sync | `POST /sync/tac` | Fetches cases, upserts into `cisco.tac_cases` |
| Smart Licensing sync | `POST /sync/smart-licensing` | Fetches entitlements, returns count (no DB write) |
| Salesforce sync | `POST /sync/salesforce` | Tests connection, returns status |

### 7.4 Meraki and AppDynamics (inline)

| Requirement | Detail |
|-------------|--------|
| **REQ-INT-080** | Meraki Dashboard data appears inline on Devices, Properties, and Integrations views (DD wave DD-K) |
| **REQ-INT-081** | AppDynamics APM data appears inline on Devices, Incidents, and Overview views (DD wave DD-L) |
| **REQ-INT-082** | Neither Meraki nor AppDynamics has a standalone page; data is contextual within existing views |

### 7.5 Power BI integration

| Requirement | Detail |
|-------------|--------|
| **REQ-INT-090** | Power BI embed via Microsoft Graph: Azure AD app registration with client credentials |
| **REQ-INT-091** | Backend generates embed token via `services/powerBiEmbed.ts`; frontend renders via `powerbi-client` SDK |
| **REQ-INT-092** | Requires `POWERBI_ENABLED=true` and all 5 Power BI env vars (tenant, client, secret, workspace, report) |
| **REQ-INT-093** | Graceful fallback: when disabled, UI shows configuration instructions |

---

## 8. Frontend application requirements

### 8.1 Technology stack

| Requirement | Detail |
|-------------|--------|
| **REQ-FE-001** | React 18 with TypeScript, Material UI v6, Vite build tool |
| **REQ-FE-002** | Dev server on port 3001 (`vite --host 0.0.0.0 --port 3001`) |
| **REQ-FE-003** | API base URL configurable via `VITE_API_BASE_URL` (defaults to `http://localhost:3000/api/v1`) |
| **REQ-FE-004** | JWT stored in `localStorage` as `accessToken` |

### 8.2 Routes and pages

| Route | Page component | Auth required | Description |
|-------|---------------|---------------|-------------|
| `/login` | `LoginPage` | No | Email/password form; dev mode prefills seed credentials |
| `/dashboard` | `DashboardPage` | Yes | 4 static KPI cards (Open Incidents, P1/P2, TAC Cases, Device Health) |
| `/incidents` | `IncidentsPage` | Yes | Fetches `GET /incidents`; renders list with incident number, title, priority, status |
| `/devices` | `DevicesPage` | Yes | Fetches `GET /devices`; renders list with hostname, IP, status |
| `/properties` | `PropertiesPage` | Yes | Fetches `GET /properties`; renders list with name, type |
| `/powerbi-pm` | `PowerBiPmDashboardPage` | Yes | Fetches Power BI embed config; renders embedded report or fallback |
| `/salesforce` | `SalesforcePage` | Yes | Fetches 6 Salesforce endpoints; KPI strip + 5 tabbed data tables |
| `*` | Redirect to `/dashboard` | — | Catch-all redirect |

### 8.3 API client functions

| Function | HTTP | Path | Purpose |
|----------|------|------|---------|
| `login(email, password)` | POST | `/auth/login` | Authenticate, store token |
| `apiGet<T>(path)` | GET | `{path}` | Generic authenticated GET |
| `apiPost<T>(path, body)` | POST | `{path}` | Generic authenticated POST |
| `apiPatch<T>(path, body)` | PATCH | `{path}` | Generic authenticated PATCH |
| `fetchPowerBiEmbed()` | GET | `/analytics/powerbi/embed` | Power BI embed config |

---

## 9. Mockup hub requirements

### 9.1 Overview

| Requirement | Detail |
|-------------|--------|
| **REQ-MOCK-001** | Static HTML/CSS/JS mockup at `backend/public/mockup/index.html` |
| **REQ-MOCK-002** | 19 view sections navigable via left sidebar with hash-based routing |
| **REQ-MOCK-003** | Three-column resizable layout: sidebar, main content, AI copilot pane |
| **REQ-MOCK-004** | Light/dark/system/daylight theme switching with geolocation-based auto-daylight |
| **REQ-MOCK-005** | Contrast modes: standard, soft, high |
| **REQ-MOCK-006** | Readability controls: text scale (A−/A/A+/A++), reduced motion toggle |
| **REQ-MOCK-007** | Navigation tab reorder via drag-and-drop with localStorage persistence |
| **REQ-MOCK-008** | Main content block reorder via drag-and-drop per view |
| **REQ-MOCK-009** | AI copilot pane with per-view contextual insights, suggested questions, and Copilot clipboard export |

### 9.2 View inventory (19 views)

| # | View ID | Title | Key features |
|---|---------|-------|-------------|
| 1 | `overview` | Overview | KPIs (8 metrics), quick actions, timeline, sync cards, DD callout, SF pulse |
| 2 | `sentiment` | Sentiment & VoC | CSAT/NPS, signal blend, escalation queue, VoC API table |
| 3 | `journeys` | Journey signals | Active journeys, friction score, telemetry, analytics APIs |
| 4 | `cx-command` | Experience command | Financial KPIs, 5 next-step cards, customer financial table, trends, AI analysis, SF exec pulse |
| 5 | `cx-role-actions` | CX role actions | Role-based action matrix with DD/Meraki/AppDynamics columns |
| 6 | `powerbi-pm` | Power BI · Global PM | Embed capabilities, PM surfaces table, mock tiles, SF role matrix |
| 7 | `incidents` | Incidents | Queue metrics, incident table, detail preview, TAC correlation, DD/SF callouts |
| 8 | `devices` | Devices | Inventory table, assurance issues, Meraki table, AppDynamics table, DD/SF callouts |
| 9 | `properties` | Properties | Property cards with filters, site mapping, tech adoption, DD readiness, SF account health |
| 10 | `integrations` | Waves & integrations | Advisor engine, wave cards, API builds table, DD wave registry |
| 11 | `mvp-journey` | MVP journey & adoption | Journey map, CSPC/IQ deep panels, DD by phase, SF pipeline by phase |
| 12 | `sources` | Source administration | Source cards, change log, env checklist, DD source readiness, SF source detail |
| 13 | `consoles` | Console ↔ wave map | Console-wave matrix, inline integrations table, DD parity, SF CRM layer |
| 14 | `sdcroles` | SDC personas & consoles | 6 persona cards, next-steps engine, 6 console cards, renewal table, persona matrix, DD recommendations, SF feeds |
| 15 | `security` | Security (PSIRT) | OpenVuln metrics, advisories table, remediation timeline, DD callout |
| 16 | `fieldnotes` | Field notices | FN metrics, FN table, bulk actions, DD remediation, SF case tracking |
| 17 | `network-as-code` | Network as Code | 9 NaC solutions, API matrix, adoption framework, ROI calculator ($886K) |
| 18 | `services-as-code` | Services as Code | 12 SaC waves, partner table, Cisco Live resources, ROI calculator ($1,258K) |
| 19 | `digital-document-solutions` | Digital Document Solutions | Document lifecycle, 12 templates, DDS API table |

### 9.3 Live mode

| Requirement | Detail |
|-------------|--------|
| **REQ-MOCK-020** | Toggle live data mode via `?live=1` or UI toggle |
| **REQ-MOCK-021** | Requires valid JWT in localStorage (same origin or pasted token) |
| **REQ-MOCK-022** | Fetches `GET /properties`, `/devices`, `/incidents`, `/tac-cases`, `/admin/sources` |
| **REQ-MOCK-023** | Overwrites mock KPIs, tables, and property cards with live API data |
| **REQ-MOCK-024** | Supports war-room creation via `POST /integrations/webex/war-room` |

### 9.4 Integration advisor

| Requirement | Detail |
|-------------|--------|
| **REQ-MOCK-030** | AI-driven integration advisor on the Waves & Integrations view |
| **REQ-MOCK-031** | Merges `APP_DATA_SNAPSHOT` with live DOM KPIs when in live mode |
| **REQ-MOCK-032** | Generates up to 6 prioritized action steps and 8 wave card recommendations |
| **REQ-MOCK-033** | Rules: P1/P2 incidents, observability gaps, health <80, stale telemetry, PSIRT/FN exposure, journey friction, ISE status |

### 9.5 AI copilot pane

| Requirement | Detail |
|-------------|--------|
| **REQ-MOCK-040** | Each of 19 views has `copilotContextPlain`, `blocks[]`, and `suggestions[]` in `AI_INSIGHTS_BY_VIEW` |
| **REQ-MOCK-041** | Blocks support `urgent: true` (magenta styling) and `dd: true` (Digitized Delivery styling) |
| **REQ-MOCK-042** | "Copy for Copilot" builds context block with view title, descriptor, insights, and user question |
| **REQ-MOCK-043** | "Open Copilot" links to `microsoft365.com/chat` for Microsoft 365 Copilot |
| **REQ-MOCK-044** | Suggested questions auto-populate the query field on click |

### 9.6 Theme and accessibility

| Requirement | Detail |
|-------------|--------|
| **REQ-MOCK-050** | Theme: dark (default), light, system-match, daylight-match (via sunrise-sunset.org API + geolocation) |
| **REQ-MOCK-051** | Daylight auto-refreshes every 30 minutes based on GPS coordinates |
| **REQ-MOCK-052** | Contrast: standard, soft (reduced border/shadow), high (increased contrast) |
| **REQ-MOCK-053** | Text scale: 4 levels via `--text-scale` CSS variable |
| **REQ-MOCK-054** | Reduced motion: respects `prefers-reduced-motion` and manual toggle |
| **REQ-MOCK-055** | Navigation density slider for sidebar spacing |
| **REQ-MOCK-056** | Brand logo automatically swaps light/dark variant based on theme |

### 9.7 Data structures

| Object | Count | Purpose |
|--------|-------|---------|
| `MGM_PROPERTIES` | 18 properties | Mock portfolio (11 Las Vegas, 7 remote) |
| `INTEGRATION_SOURCES` | 18 sources | Source registry mock data |
| `CONSOLE_MAP_ROWS` | 21 rows | Console-to-wave mapping matrix |
| `MVP_JOURNEY_BY_WAVE` | 16 waves (W1-W16) | Journey map with phase, maturity, and recommendations |
| `APP_DATA_SNAPSHOT` | 1 object | Unified mock KPIs for personas and advisor |

---

## 10. Digitized Delivery requirements

### 10.1 Network as Code (NaC)

| Requirement | Detail |
|-------------|--------|
| **REQ-DD-001** | 9 NaC solutions tracked: Catalyst Center, SD-WAN, ISE, IOS-XE, and 5 NaC tools |
| **REQ-DD-002** | 42% automation readiness metric across 1,626 devices (DNA + Meraki) |
| **REQ-DD-003** | ROI calculator with 8 configurable inputs; estimated 3-year ROI $886K |
| **REQ-DD-004** | 4-phase adoption framework: Assess → Pilot → Scale → Operate |
| **REQ-DD-005** | NaC API matrix showing Terraform providers, Ansible collections, pyATS tests per solution |

### 10.2 Services as Code (SaC)

| Requirement | Detail |
|-------------|--------|
| **REQ-DD-010** | 12 SaC waves (A–J + AI Assistant + DDS) |
| **REQ-DD-011** | Wave cards: ACI, SD-WAN, Wireless, ISE, Meraki, Catalyst Center, ThousandEyes, FMC, IOS-XE, Webex, AI Assistant, DDS |
| **REQ-DD-012** | 14 technologies, 7 dev waves, 38% coverage, 3 partner routes |
| **REQ-DD-013** | ROI calculator; estimated 3-year ROI $1,258K |
| **REQ-DD-014** | Partner integration table and Cisco Live resources |

### 10.3 Digital Document Solutions (DDS)

| Requirement | Detail |
|-------------|--------|
| **REQ-DD-020** | 12 document templates across 4 lifecycle phases |
| **REQ-DD-021** | Template categories: assessment, runbook, incident summary, QBR pack |
| **REQ-DD-022** | DDS API summary table |

### 10.4 DD integration across views

| Requirement | Detail |
|-------------|--------|
| **REQ-DD-030** | Every DD callout uses CSS class `dd-callout` with magenta (Splunk) accent color |
| **REQ-DD-031** | DD callouts present on 12 of 19 views: overview, cx-role-actions, incidents, devices, properties, integrations, mvp-journey, sources, consoles, sdcroles, security, fieldnotes |
| **REQ-DD-032** | DD automation waves DD-A through DD-N mapped in the integration wave registry |
| **REQ-DD-033** | AI insight blocks with `dd: true` flag present in 11 views |
| **REQ-DD-034** | Meraki as Code (DD-K) and AppDynamics (DD-L) tracked as DD waves with metrics |

---

## 11. Salesforce CRM integration requirements

### 11.1 Authentication

| Requirement | Detail |
|-------------|--------|
| **REQ-SF-001** | OAuth 2.0 password grant via Salesforce Connected App |
| **REQ-SF-002** | Token cached with 110-minute TTL; auto-invalidation on 401 |
| **REQ-SF-003** | Requires: `SALESFORCE_ENABLED`, `CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `PASSWORD` |
| **REQ-SF-004** | Optional `SECURITY_TOKEN` appended to password |

### 11.2 API endpoints

| ID | Method | Path | Roles | Description |
|----|--------|------|-------|-------------|
| **REQ-SF-010** | GET | `/salesforce/status` | Any authenticated | Test connection; returns `ok`, `instanceUrl`, `orgId` |
| **REQ-SF-011** | GET | `/salesforce/cases` | All SF roles | Query Cases with limit (max 500) |
| **REQ-SF-012** | GET | `/salesforce/accounts` | All SF roles | Query Accounts |
| **REQ-SF-013** | GET | `/salesforce/contacts` | All SF roles | Query Contacts; optional `accountId` filter (validated: 15-18 alphanumeric) |
| **REQ-SF-014** | GET | `/salesforce/opportunities` | All SF roles | Query Opportunities |
| **REQ-SF-015** | GET | `/salesforce/entitlements` | All SF roles | Query Entitlements |
| **REQ-SF-016** | GET | `/salesforce/service-contracts` | All SF roles | Query Service Contracts |
| **REQ-SF-017** | GET | `/salesforce/tasks` | All SF roles | Query open Tasks |
| **REQ-SF-018** | GET | `/salesforce/knowledge` | All SF roles | Query published Knowledge articles (max 200) |
| **REQ-SF-019** | GET | `/salesforce/console-summary` | All SF roles | Aggregated metrics for PM, Delivery, Success, Renewals, Architect consoles |
| **REQ-SF-020** | POST | `/salesforce/cases` | Write roles | Create Case with validated fields: `subject` (required, max 500), `description` (max 5000), `priority` (enum), `accountId`/`contactId` (SF ID format) |
| **REQ-SF-021** | PATCH | `/salesforce/cases/:caseId` | Write roles | Update Case; allowed fields: Status, Priority, Description, Subject; `caseId` validated as SF ID format |

### 11.3 Salesforce objects queried

| Object | SOQL fields | Console mapping |
|--------|-------------|-----------------|
| Case | Id, CaseNumber, Subject, Status, Priority, Type, Origin, Account.Name, Contact.Name, Owner.Name, CreatedDate, ClosedDate | Service Delivery, PM |
| Account | Id, Name, Type, Industry, Phone, Website, BillingCity, BillingState, Owner.Name, AnnualRevenue | PM, Success, HTOM |
| Contact | Id, FirstName, LastName, Email, Phone, Title, Department, Account.Name | PM, Success |
| Opportunity | Id, Name, StageName, Amount, CloseDate, Probability, Type, AccountId, Owner.Name, NextStep, FiscalYear | Renewals, PM |
| Entitlement | Id, Name, AccountId, Account.Name, StartDate, EndDate, Status, Type, RemainingCases | Success, Renewals |
| ServiceContract | Id, Name, AccountId, Account.Name, StartDate, EndDate, Status, Term, ApprovalStatus | Renewals |
| Task | Id, Subject, Status, Priority, ActivityDate, Owner.Name, Type | All consoles |
| Knowledge__kav | Id, Title, ArticleNumber, PublishStatus, VersionNumber | Knowledge base |

### 11.4 Console summary aggregation

The `/console-summary` endpoint computes:

| Console | Metrics |
|---------|---------|
| PM | `totalAccounts`, `activeOpportunities`, `pipelineValue`, `closedWonCount`, `openTasks` |
| Delivery | `openCases`, `highPriorityCases`, `totalCases` |
| Success | `totalAccounts`, `activeEntitlements`, `openTasks` |
| Renewals | `totalEntitlements`, `activeEntitlements`, `expiringIn90Days`, `pipelineValue`, `pipelineCount` |
| Architect | `totalAccounts`, `totalCases` |

### 11.5 SF panels in mockup hub

Salesforce CRM panels (`sf-panel`, blue accent `#00a1e0`) are present on 11 views: overview, cx-command, powerbi-pm, incidents, devices, properties, mvp-journey, sources, consoles, sdcroles, fieldnotes.

---

## 12. Infrastructure and deployment

### 12.1 Docker Compose

| Service | Image | Port | Config |
|---------|-------|------|--------|
| `postgres` | `postgres:15-alpine` | 5432 | DB: `helix_sdm`, user: `serviceflow_admin`, volume: `pg_data` |
| `redis` | `redis:7-alpine` | 6379 | Default config |
| `backend` | Build from `./backend` | 3000 | `env_file: .env.example`, depends on postgres + redis |
| `frontend` | Build from `./frontend` | 3001 | `VITE_API_BASE_URL=http://localhost:3000/api/v1`, depends on backend |

### 12.2 CI/CD workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push, PR | Backend: install, build, lint, test; Frontend: same |
| `deploy-mockup-pages.yml` | Push to main, manual | Deploy `backend/public/mockup/` to GitHub Pages |
| `scheduled-autofix.yml` | Monday 09:00 UTC, manual | `lint:fix` in backend + frontend; auto-PR if changes |

### 12.3 Migration and seeding

```bash
npm run migrate    # Runs 001_init.sql + 001_seed.sql
npm run seed-passwords  # Hashes dev passwords for seed users
```

---

## 13. Security requirements

### 13.1 Authentication security

| Requirement | Detail |
|-------------|--------|
| **REQ-SEC-001** | JWT secrets minimum 32 characters; validated at startup via Zod |
| **REQ-SEC-002** | Passwords hashed with bcrypt (configurable rounds, default 12) |
| **REQ-SEC-003** | Generic error messages on authentication failure (no account enumeration) |
| **REQ-SEC-004** | SSO state stored in signed httpOnly cookie with PKCE |
| **REQ-SEC-005** | Login page default credentials gated behind `import.meta.env.DEV` |

### 13.2 Input validation

| Requirement | Detail |
|-------------|--------|
| **REQ-SEC-010** | Zod schema validation on all request bodies |
| **REQ-SEC-011** | Parameterized SQL queries throughout (no string concatenation) |
| **REQ-SEC-012** | Salesforce ID format validation (`/^[a-zA-Z0-9]{15,18}$/`) on all SF ID inputs |
| **REQ-SEC-013** | String length bounds on user-supplied content (subject: 500, description: 5000, title: 200) |
| **REQ-SEC-014** | Priority values validated against allow-list enum |

### 13.3 Transport and headers

| Requirement | Detail |
|-------------|--------|
| **REQ-SEC-020** | Helmet security headers on all responses (path-specific CSP) |
| **REQ-SEC-021** | CORS restricted to configured origins |
| **REQ-SEC-022** | JSON body size limited to 1 MB |
| **REQ-SEC-023** | Mockup CSP relaxed (allows `https:` and `wss:` for external resources) |
| **REQ-SEC-024** | Power BI CSP allows Microsoft embed domains |

### 13.4 Error handling

| Requirement | Detail |
|-------------|--------|
| **REQ-SEC-030** | All async route handlers wrapped in try/catch with appropriate error codes |
| **REQ-SEC-031** | External API failures return 502; internal failures return 500 |
| **REQ-SEC-032** | Error messages truncated (max 300 chars from upstream APIs) |

---

## 14. Observability and audit

### 14.1 Audit logging

| Requirement | Detail |
|-------------|--------|
| **REQ-AUDIT-001** | Fire-and-forget `INSERT` into `audit.activity_log` for security-sensitive operations |
| **REQ-AUDIT-002** | Logged fields: `event_type`, `user_id`, `ip_address`, `user_agent`, `metadata` (JSONB with method, path) |
| **REQ-AUDIT-003** | Audit events: `property.create`, `device.create`, `incident.create`, `incident.status.update`, `incident.update.create`, `incident.tac.link` |

### 14.2 Health monitoring

| Requirement | Detail |
|-------------|--------|
| **REQ-AUDIT-010** | Health endpoint verifies database connectivity (`SELECT 1`) |
| **REQ-AUDIT-011** | Redis connects at startup with non-fatal failure (`.catch(() => undefined)`) |

---

## 15. Non-functional requirements

### 15.1 Performance

| Requirement | Detail |
|-------------|--------|
| **REQ-NFR-001** | Database connection pool: max 10 connections |
| **REQ-NFR-002** | Salesforce token cache with 110-minute TTL to minimize auth round-trips |
| **REQ-NFR-003** | Salesforce query limits enforced server-side (max 500 records per query) |
| **REQ-NFR-004** | Console-summary endpoint parallelizes 5 Salesforce queries via `Promise.all` |

### 15.2 Accessibility

| Requirement | Detail |
|-------------|--------|
| **REQ-NFR-010** | Mockup hub supports screen reader announcements via `aria-live` regions |
| **REQ-NFR-011** | Keyboard navigation for sidebar (Alt+↑/↓), pane resize (arrows), and view focus |
| **REQ-NFR-012** | Skip-to-content link |
| **REQ-NFR-013** | `prefers-reduced-motion` respected and manually toggleable |
| **REQ-NFR-014** | 4-level text scaling for readability |

### 15.3 Browser support

| Requirement | Detail |
|-------------|--------|
| **REQ-NFR-020** | Mockup hub uses CSS custom properties, grid, flexbox (modern browsers) |
| **REQ-NFR-021** | Power BI embed requires powerbi-client SDK (modern browsers) |

### 15.4 Development experience

| Requirement | Detail |
|-------------|--------|
| **REQ-NFR-030** | Hot reload via `tsx watch` (backend) and `vite` (frontend) |
| **REQ-NFR-031** | TypeScript strict mode enabled |
| **REQ-NFR-032** | ESLint with TypeScript parser |
| **REQ-NFR-033** | Vitest for testing (framework configured, no tests written yet) |

---

## 16. Out of scope (MVP)

- Advanced reporting beyond basic JSON/CSV export
- Mobile-native applications (iOS/Android)
- Multi-region / high-availability database topology
- Standalone Meraki Dashboard or AppDynamics pages (inline only)
- Real-time WebSocket push notifications
- Email notification system
- Microsoft Teams integration (env vars defined, not implemented)
- ThousandEyes, Umbrella, Stealthwatch, DWDM, Cisco IQ, CSPC, Cisco Spaces, Secure Access direct API wiring (source config registry and mockup data exist; no live sync jobs)

---

## 17. Milestones and definition of done

### 17.1 Functional milestones

| # | Milestone | Description |
|---|-----------|-------------|
| 1 | Bootstrap | Project scaffold, Docker Compose, CI pipeline |
| 2 | Database + seed | Schema migration, seed data, dev password hashing |
| 3 | Core APIs | Properties, devices, incidents (CRUD + timeline), TAC linkage |
| 4 | Frontend | React SPA with login, dashboard, list pages |
| 5 | DNA + TAC | DNA Center device sync, TAC case sync, live data in UI |
| 6 | Waves 5–16 | Source registry, connection testing, mockup data for all waves |
| 7 | Meraki + AppDynamics | Inline data on Devices, Properties, Incidents views |
| 8 | Digitized Delivery | NaC/SaC/DDS surfaces, DD waves in registry, ROI calculators |
| 9 | Salesforce CRM (Wave 17) | Full CRUD, console-summary, all SDC console feeds |
| 10 | QA + hardening | Security review, audit, error handling, input validation |
| 11 | Deployment runbook | Non-prod deployment documentation, smoke tests |

### 17.2 Definition of done

- [ ] `docker compose up` starts all services; health check returns OK
- [ ] Login with seed credentials; RBAC enforced on all protected routes
- [ ] Incidents: create, update status, add timeline, link TAC case
- [ ] Device inventory synced from at least one integration (DNA Center)
- [ ] CI passes: build, lint, type-check for both backend and frontend
- [ ] Per enabled integration: console-equivalent core tasks available via API
- [ ] Meraki/AppDynamics visible inline where specified (DD-K, DD-L)
- [ ] NaC/SaC/DDS surfaces with magenta accent, DD waves DD-A–DD-N in registry
- [ ] Salesforce powering all 6 SDC consoles, Wave 17 in source registry
- [ ] Experience Command console-summary with live SF aggregation
- [ ] 19-view mockup hub with DD callouts, SF panels, AI insights, and live mode
- [ ] Audit logging on security-sensitive operations
- [ ] All route handlers have try/catch error handling
- [ ] No hardcoded credentials in production builds

---

## Appendix A — Environment variables

Full inventory of 50+ environment variables documented in `.env.example`:

**App:** `NODE_ENV`, `PORT`, `FRONTEND_PORT`, `APP_PUBLIC_URL`

**Database:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

**Redis:** `REDIS_HOST`, `REDIS_PORT`

**Security:** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, `BCRYPT_ROUNDS`

**CORS:** `CORS_ORIGIN`, `SOCKET_IO_PATH`, `SOCKET_IO_CORS`

**SSO/OIDC:** `SSO_ENABLED`, `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `SSO_SUCCESS_REDIRECT`, `SSO_SCOPES`, `SSO_JIT_DEFAULT_ROLE`

**TAC:** `TAC_API_KEY`, `TAC_API_SECRET`, `TAC_BASE_URL`, `TAC_CONTRACT_NUMBER`

**DNA Center:** `DNA_CENTER_HOST`, `DNA_CENTER_USERNAME`, `DNA_CENTER_PASSWORD`, `DNA_CENTER_PORT`

**Smart Licensing:** `SMART_LICENSING_CLIENT_ID`, `SMART_LICENSING_CLIENT_SECRET`, `SMART_LICENSING_TOKEN_URL`, `SMART_LICENSING_API_URL`

**WebEx:** `WEBEX_CLIENT_ID`, `WEBEX_CLIENT_SECRET`, `WEBEX_BOT_TOKEN`, `WEBEX_WEBHOOK_SECRET`, `WEBEX_REDIRECT_URI`

**Support APIs:** `CISCO_SUPPORT_API_KEY`, `CISCO_SUPPORT_API_SECRET`

**PSIRT:** `OPENVULN_CLIENT_ID`, `OPENVULN_CLIENT_SECRET`, `OPENVULN_TOKEN_URL`

**Field Notices:** `FIELD_NOTICE_API_BASE_URL`, `CISCO_FN_API_KEY`

**FMC:** `FMC_BASE_URL`, `FMC_API_TOKEN`

**Power BI:** `POWERBI_ENABLED`, `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`, `POWERBI_WORKSPACE_ID`, `POWERBI_REPORT_ID`

**Salesforce:** `SALESFORCE_ENABLED`, `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_SECURITY_TOKEN`, `SALESFORCE_API_VERSION`

**Feature flags:** `ENABLE_TAC_AUTO_CREATE`, `ENABLE_TEAMS_INTEGRATION`, `ENABLE_WEBEX_INTEGRATION`, `ENABLE_EMAIL_NOTIFICATIONS`

---

## Appendix B — Database schema

### Schemas and extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE SCHEMA IF NOT EXISTS mgm;
CREATE SCHEMA IF NOT EXISTS cisco;
CREATE SCHEMA IF NOT EXISTS audit;
```

### Core table definitions

**`mgm.users`** — `user_id` UUID PK, `email` UNIQUE, `full_name`, `role` (admin|sdm|tam|csm|engineer|manager|viewer), `password_hash`, timestamps

**`mgm.properties`** — `property_id` UUID PK, `name`, `property_type` (hotel|casino|resort|venue), `it_manager_user_id` FK, timestamps

**`mgm.devices`** — `device_id` UUID PK, `property_id` FK, `hostname`, `ip_address` INET, `ipv6_address`, `mac_address`, `serial_number`, `status` (active|inactive|maintenance|decommissioned|failed), `dna_device_id`, `dna_managed` BOOLEAN, `health_score`, contract/warranty/EOL fields, timestamps

**`mgm.incidents`** — `incident_id` UUID PK, `incident_number` UNIQUE (auto-sequence), `parent_incident_id` self-FK, `property_id` FK, `device_id` FK, `title`, `description`, `priority` (P1-P4), `status` (open|acknowledged|investigating|in-progress|pending|resolved|closed|cancelled), `reported_by` FK, `assigned_to` FK, `tac_case_number`, `tac_case_id` FK, `tac_severity` (1-4), `resolution_time`, timestamps

**`mgm.incident_updates`** — `update_id` UUID PK, `incident_id` FK, `user_id` FK, `content`, `created_at`

**`cisco.tac_cases`** — `tac_case_id` UUID PK, `case_number` UNIQUE, `severity` (1-4), `status`, `incident_id` FK, `last_update_at`, timestamps

**`audit.activity_log`** — `log_id` UUID PK, `event_type`, `user_id`, `ip_address`, `user_agent`, `metadata` JSONB, `created_at`

**`mgm.integration_source_configs`** (runtime) — `source_name` TEXT PK, `enabled` BOOLEAN, `base_url`, `auth_type`, `schedule`, `credentials_ref`, `notes`, `updated_by` UUID, timestamps

---

## Appendix C — API route inventory

### Authentication (public)

| Method | Path | Body/Query | Response |
|--------|------|-----------|----------|
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ accessToken, refreshToken }` |
| POST | `/api/v1/auth/refresh` | `{ refreshToken }` | `{ accessToken }` |
| POST | `/api/v1/auth/logout` | — | 204 |
| GET | `/api/v1/auth/sso/login` | — | 302 to IdP |
| GET | `/api/v1/auth/sso/callback` | OIDC params | 302 to success URL |

### Core resources (Bearer JWT required)

| Method | Path | Roles | Body/Query | Response |
|--------|------|-------|-----------|----------|
| GET | `/api/v1/health` | — | — | `{ status }` |
| GET | `/api/v1/properties` | Any | — | `Property[]` |
| POST | `/api/v1/properties` | admin, sdm, manager | `{ name, propertyType }` | Property |
| GET | `/api/v1/devices` | Any | — | `Device[]` |
| POST | `/api/v1/devices` | admin, sdm, engineer, manager | `{ propertyId, hostname, ipAddress, serialNumber, status }` | Device |
| GET | `/api/v1/incidents` | Any | — | `Incident[]` |
| POST | `/api/v1/incidents` | admin, sdm, tam, csm, engineer, manager | `{ propertyId, deviceId?, title, description, priority }` | Incident |
| PATCH | `/api/v1/incidents/:id` | admin, sdm, tam, engineer, manager | `{ status }` | `{ incident_id, status }` |
| POST | `/api/v1/incidents/:id/updates` | Any | `{ content }` | Update |
| POST | `/api/v1/incidents/:id/tac-link` | admin, sdm, tam, engineer | `{ tacCaseNumber, tacSeverity }` | `{ incident_id, tac_case_number, tac_severity }` |
| GET | `/api/v1/tac-cases` | Any | — | `TacCase[]` |

### Integrations and admin

| Method | Path | Roles | Body/Query | Response |
|--------|------|-------|-----------|----------|
| POST | `/api/v1/integrations/webex/war-room` | admin, sdm, tam, manager, engineer | `{ title? }` | `{ roomId, title, webUrl }` |
| POST | `/api/v1/integrations/sync/:source` | admin, sdm, tam, manager | — | `{ source, processed, status? }` |
| GET | `/api/v1/admin/sources` | admin, sdm, manager | — | `SourceConfig[]` |
| PUT | `/api/v1/admin/sources/:name` | admin, sdm, manager | Partial config | SourceConfig |
| POST | `/api/v1/admin/sources/:name/test` | admin, sdm, tam, manager | — | `{ sourceName, status }` |
| GET | `/api/v1/analytics/powerbi/embed` | All roles | — | PowerBiEmbed |

### Salesforce CRM

| Method | Path | Roles | Body/Query | Response |
|--------|------|-------|-----------|----------|
| GET | `/api/v1/salesforce/status` | Any | — | `{ ok, instanceUrl?, orgId? }` |
| GET | `/api/v1/salesforce/cases` | SF_ROLES | `?limit=N` | `{ configured, totalSize, records }` |
| GET | `/api/v1/salesforce/accounts` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/contacts` | SF_ROLES | `?limit=N&accountId=X` | Same pattern |
| GET | `/api/v1/salesforce/opportunities` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/entitlements` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/service-contracts` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/tasks` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/knowledge` | SF_ROLES | `?limit=N` | Same pattern |
| GET | `/api/v1/salesforce/console-summary` | SF_ROLES | — | Aggregated console metrics |
| POST | `/api/v1/salesforce/cases` | SF_WRITE | `{ subject, description?, priority?, accountId?, contactId? }` | `{ id, success }` |
| PATCH | `/api/v1/salesforce/cases/:caseId` | SF_WRITE | `{ Status?, Priority?, Description?, Subject? }` | `{ id, updated }` |
