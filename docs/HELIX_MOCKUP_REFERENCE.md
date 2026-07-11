# Helix UI Mockup Hub — Reference & Playbook

**Document purpose:** Describe each hub **page** (view), its **intended audience**, **widgets and modules**, **data integrations and API connectors**, and a **how-to** oriented to **customer experience and delivery roles**.  

**Scope:** Static mockup at `backend/public/mockup/` (`index.html` + `mockup-hub.js`). Metrics, tables, and most actions are **illustrative** unless **Live data** is enabled with a valid JWT from Operations on the same host.  

**Deep links:** `http(s)://<host>/mockup/#<view-id>` — see §2 for view IDs.  

**Trademark note:** Cisco, Microsoft, Webex, Splunk, and other names identify third-party products and may be trademarks of their owners. This document describes an internal demonstration narrative only.

---

## 1. Global shell (all pages)

| Module | Description |
| --- | --- |
| **Left navigation** | Tab list for all views; order can be customized via drag-and-drop (persisted in browser `localStorage`). |
| **Top bar** | Page title, subtitle, **Appearance** (light / dark / system / daylight-at-location), **Contrast** (standard / soft / high), column balance controls. |
| **Live data strip** | Toggle **Live data**, refresh, JWT hint; **MVP scope** pill; **integration advisor** strip (contextual next steps). |
| **Main content** | One visible **view** (`section.view`) at a time. |
| **Right rail — Deep insights** | Mock Microsoft 365 Copilot–style narrative that changes per tab; for demo copy only. |
| **Sidebar footer** | Local time widget (geolocation + reverse geocode when permitted), nav spacing control, Operations / token hints. |

**Intended audience (shell):** anyone running a **demo**, **training**, or **architecture** session on the Helix/MGM GES-West narrative.

---

## 2. Page index

| # | View ID (hash) | Page title |
| --- | --- | --- |
| 1 | `overview` | Overview |
| 2 | `sentiment` | Sentiment & VoC |
| 3 | `journeys` | Journey signals |
| 4 | `cx-command` | Experience command |
| 5 | `cx-role-actions` | CX role actions |
| 6 | `powerbi-pm` | Power BI · Global PM |
| 7 | `incidents` | Incidents |
| 8 | `devices` | Devices |
| 9 | `properties` | Properties |
| 10 | `integrations` | Waves & integrations |
| 11 | `mvp-journey` | MVP journey & adoption |
| 12 | `sources` | Source administration |
| 13 | `consoles` | Console ↔ wave map |
| 14 | `sdcroles` | SDC personas & consoles |
| 15 | `security` | Security (PSIRT) |
| 16 | `fieldnotes` | Field notices |

**Related surfaces (outside hub shell):** Live source admin `/admin/sources.html`; Power BI embed `/powerbi-pm.html`; logo variants `/mockup/helix-logo-variants.html`.

---

## 3. Integration & wave registry (summary)

MVP narrative assumes **Waves 1–16** aligned to Cisco API integrations. Registry entries in the mock mirror backend `VALID_SOURCES` / `integration_source_configs` concepts.

| Wave | Source key | Product / domain | Typical auth pattern (mock) | Cadence (illustrative) |
| --- | --- | --- | --- | --- |
| W1 | `dna-center` | Catalyst Center — inventory, assurance, sites | Basic / token | `*/30 * * * *` |
| W2 | `tac` | TAC Service Request API | API key + secret | `*/15 * * * *` |
| W3 | `smart-licensing` | Smart Licensing / SWAPI | OAuth2 client credentials | hourly |
| W4 | `webex`, `support-api` | Control Hub; Support APIs (EoX, bugs, contract) | Bot OAuth; API key | manual / nightly |
| W5 | `thousandeyes` | ThousandEyes synthetics & paths | API token | `*/15 * * * *` |
| W6 | `umbrella` | Umbrella reporting / Investigate | API key / OAuth | hourly |
| W7 | `stealthwatch` | Secure Network Analytics | Basic or token | `*/30 * * * *` |
| W8 | `dwdm` | Optical / transport EMS | Collector / EMS | hourly |
| W9 | `cisco-iq` | Cisco IQ insights | OAuth / API key | nightly |
| W10 | `cspc` | CSPC collector / Smart Account upload | Collector registration | nightly |
| W11 | `ise` | ISE — ERS, OpenAPI, pxGrid | ERS / pxGrid | `*/30 * * * *` |
| W12 | `cisco-spaces` | Cisco Spaces / location | OAuth / API key | hourly |
| W13 | `secure-access` | Secure Access (SSE / ZTNA) | OAuth2 client credentials | `*/15 * * * *` |
| W14 | `psirt-openvuln` | PSIRT / OpenVuln (advisories, CVE ↔ inventory) | OAuth2 `id.cisco.com` | nightly |
| W15 | `field-notices` | Field Notice API / feed | API key / OAuth | nightly |
| W16 | `fmc` | Firepower Management Center (FTD inventory, policies) | Token / basic | `*/30 * * * *` |

**Mock “enabled” defaults (KPI strip on Sources):** commonly **four** sources shown as on — **`dna-center`**, **`tac`**, **`smart-licensing`**, **`fmc`** — with others off until configured.

**Non-Cisco bridges (mock registry):** e.g. **Microsoft Teams** (`teams` — Graph / Bot), called out where PM/collaboration handoff is part of the story.

---

## 4. Voice-of-customer & analytics connectors (conceptual)

These appear in **Sentiment & VoC** and **Journey signals** as **integration catalog** tables (mock auth and scheduling text). Production would normalize into a single VoC/event model.

| System | Role in narrative |
| --- | --- |
| **Qualtrics, Medallia, Dynamics Customer Voice** | Survey CSAT/NPS ingestion |
| **Zendesk, Salesforce Service Cloud** | Case and thread sentiment |
| **Webex Contact Center** | Transcript and queue analytics |
| **Adobe Experience Platform / event bus** | Journey-step telemetry |
| **ThousandEyes, DNA intent** | Infra friction correlated to journey health |

---

## 5. Page-by-page reference

### 5.1 Overview — `#overview`

| | |
| --- | --- |
| **Purpose** | Command surface for portfolio health and integration sync posture. |
| **Primary audience** | SDM, Engineer (read), PM (read), CXM (read). |

**Widgets / modules**

| Widget | Description |
| --- | --- |
| **KPI grid** | Open incidents, P1/P2, devices monitored, TAC linkage, license compliance, advisory exposure, field notices, blended guest sentiment. Live hooks update select KPIs when Live data is on. |
| **Quick actions** | Clusters: Respond & escalate; Inventory & policy (DNA, FMC, ISE); Observability (ThousandEyes, Umbrella, SNA, DWDM); Risk & VoC hooks (licensing, OpenVuln, FN, IQ, CSPC). Buttons are mock (`alert`). |
| **Activity timeline** | Recent events (TAC link, FN match, wave validation). |
| **Integration sync status** | Cards driven from mock registry + `OVERVIEW_SYNC_LINES` for enabled sources. |

**Integrations most referenced:** W1 DNA, W2 TAC, W3 Licensing, W16 FMC, plus W5–W8 observability, W14–W15 risk feeds, W9–W10 insight collectors.

---

### 5.2 Sentiment & VoC — `#sentiment`

| | |
| --- | --- |
| **Purpose** | Blended customer sentiment, escalation threads, VoC integration catalog. |
| **Primary audience** | CXM, SDM, PM (read). |

**Widgets:** CSAT / NPS / at-risk journeys / VoC ingest lag KPIs; **signal blend** bar; **escalation queue** timeline; **Voice-of-customer API integrations** table (systems in §4).

**Integrations:** VoC platforms (survey + case + CC); operationally ties to **Incidents**, **Journey signals**, **Experience command**.

---

### 5.3 Journey signals — `#journeys`

| | |
| --- | --- |
| **Purpose** | Journey health vs infrastructure friction; analytics API map. |
| **Primary audience** | CXM, CDA, SDM. |

**Widgets:** KPI strip; **journey health grid** (phase, sentiment, driver, linked incidents); **Journey & product analytics APIs** table (Adobe AEP-style, DNA, internal bus).

**Integrations:** DNA assurance/intent, event platforms, TE paths; mock joins to incidents.

---

### 5.4 Experience command — `#cx-command`

| | |
| --- | --- |
| **Purpose** | Cross-program **unified queue**: financial KPIs, ranked **next steps** (PM / Delivery / CX / Renewals / Architect), customer financial table, trend charts, **AI analysis** recommendations. |
| **Primary audience** | CXM, Renewals, PM, SDM, CDA — **executive** and **QBR** prep. |

**Widgets:** Outcome KPIs; **Recommended next steps** (Visibility vs Action cards with mock jumps); **Customer financial detail**; sparkline/trend panels; **AI analysis** list with confidence; export/RAID mock buttons.

**Integrations:** CPQ/ERP (narrative), Smart Licensing, VoC, incidents/devices — production cites source-backed metrics.

---

### 5.5 CX role actions — `#cx-role-actions`

| | |
| --- | --- |
| **Purpose** | Single page for **adoption**, **cost**, **speed**, and **CSAT** priorities **by role** (PM, SDM, CXM, Delivery Architect, Engineer). |
| **Primary audience** | Customer experience and delivery roles (workshop / QBR). |

**Widgets:** Four-outcome KPIs; **Recommended actions by role** grid (`#cx-role-actions-mount`) — content refreshes when the tab is opened (mock `APP_DATA_SNAPSHOT` narrative).

**Integrations:** Cross-cuts waves, sources, incidents, sentiment — use as **orchestration** narrative, not a single connector.

---

### 5.6 Power BI · Global PM — `#powerbi-pm`

| | |
| --- | --- |
| **Purpose** | Describe **Microsoft Power BI** embed for program management; link to live embed page. |
| **Primary audience** | PM, SDM, CXM (read), executive sponsors. |

**Widgets:** Embed readiness KPIs; **PM dashboard surfaces** table (executive summary, RAID, milestones, financials, capacity, regional drill, VoC, integration health); **Embed flow** checklist; mock tile strip for static demo.

**Integrations:** Power BI REST `GenerateToken` via backend `GET /api/v1/analytics/powerbi/embed` (see `docs/POWERBI_GLOBAL_PM.md`); Azure AD service principal.

---

### 5.7 Incidents — `#incidents`

| | |
| --- | --- |
| **Purpose** | Incident operations — queue, filters, table, detail preview, TAC correlation. |
| **Primary audience** | SDM, Engineer. |

**Widgets:** Queue KPIs (open, P1/P2, TAC, API total — wired partially to live API); toolbar; filter chips; **mock table**; detail preview (**INC-20244** sketch); TAC correlation table.

**Integrations:** **`/api/v1/incidents`**; W2 TAC API (narrative).

---

### 5.8 Devices — `#devices`

| | |
| --- | --- |
| **Purpose** | Inventory sample — Catalyst Center + FMC (W16) flavor: hostnames, roles, health, CVEs, sites, assurance. |
| **Primary audience** | Engineer, SDM, CDA. |

**Widgets:** Filter chips; inventory table; **Sync now** (mock); **assurance issues** panel.

**Integrations:** W1 DNA, W11 ISE context, W16 FMC, W14 advisory join (narrative).

---

### 5.9 Properties — `#properties`

| | |
| --- | --- |
| **Purpose** | Portfolio cards — Las Vegas vs **remote**; adoption; incidents; wave tags; site mapping panels. |
| **Primary audience** | PM, CXM, CDA, SDM. |

**Widgets:** Region chips; property cards; **Property ↔ site mapping**; **Technology at property** from mock registry.

**Integrations:** DNA sites, wave coverage tags; links to Devices/Incidents in production.

---

### 5.10 Waves & integrations — `#integrations`

| | |
| --- | --- |
| **Purpose** | MVP **wave** cards, KPIs, **API connection builds** matrix. |
| **Primary audience** | CDA, SDM, PM. |

**Widgets:** Summary KPIs; **wave grid** (`MVP_SCOPE_FREEZE` narrative); sortable/filterable **API builds** table from `INTEGRATION_SOURCES`.

**Integrations:** Full W1–W16 catalog (§3).

---

### 5.11 MVP journey & adoption — `#mvp-journey`

| | |
| --- | --- |
| **Purpose** | **Six-phase Cisco customer journey** map with each MVP wave positioned; deep **CSPC** and **Cisco IQ** panels. |
| **Primary audience** | PM, SDM, CDA, CXM (adoption storytelling). |

**Widgets:** Journey legend; per-wave rails with maturity % (mock); **CSPC** KPI list; **Cisco IQ** KPI list; live note when `/api/v1/admin/sources` is merged.

**Integrations:** W10 CSPC, W9 Cisco IQ, plus wave placement for all W1–W16.

---

### 5.12 Source administration — `#sources`

| | |
| --- | --- |
| **Purpose** | Operator view parallel to **`/admin/sources.html`**: cards, filters, audit log, environment checklist. |
| **Primary audience** | SDM, platform admin. |

**Widgets:** Enabled/total KPIs; toolbar; per-source **cards** (`source-mock-cards`); change log; **environment checklist** (`OPENVULN_*`, `FIELD_NOTICE_*`, `FMC_*`, ISE).

**Integrations:** All registry keys; Live data merges real registry rows for authorized tokens.

---

### 5.13 Console ↔ wave map — `#consoles`

| | |
| --- | --- |
| **Purpose** | Map **vendor consoles / surfaces** to MVP waves; **out of MVP** callouts (e.g. Meraki, AppDynamics). |
| **Primary audience** | CDA, PM. |

**Widgets:** Filterable table (`CONSOLE_MAP_ROWS` + narrative); parity rule: **API-first**, no scraping.

**Integrations:** DevNet API Console; product UIs listed as contextual only.

---

### 5.14 SDC personas & consoles — `#sdcroles`

| | |
| --- | --- |
| **Purpose** | **Persona workspaces** (PM, SDM, CXM, CDA, Engineer, HTOM); **live recommended next steps**; program console cards; renewal pipeline; RACI. |
| **Primary audience** | **All** SDC personas — onboarding and governance. |

**Widgets:** Persona sections with jump links; **recommended next steps** panel; renewal table; console matrix; doc pointers.

**Integrations:** Summarizes cross-surface use of Helix vs native consoles (DNA, FMC, etc.).

---

### 5.15 Security (PSIRT) — `#security`

| | |
| --- | --- |
| **Purpose** | OpenVuln-themed **advisory** grid, exposure, remediation queue, OAuth health (masked). |
| **Primary audience** | SecOps, NetEng, SDM, Engineer. |

**Widgets:** KPIs; advisory table; remediation queue; token panel mock.

**Integrations:** W14 OpenVuln (`id.cisco.com` OAuth); inventory join from DNA serials (narrative).

---

### 5.16 Field notices — `#fieldnotes`

| | |
| --- | --- |
| **Purpose** | Field-notice KPIs; FN table (ID, severity, PID scope, property matches); bulk **mock** actions. |
| **Primary audience** | SDM, NetEng, PM. |

**Widgets:** KPI strip; FN table; export / incident / email owner buttons (mock).

**Integrations:** W15 Field Notice API/feed + inventory correlation.

---

## 6. How-to by customer experience & delivery role

Use this as a **facilitator script**. Deep links use `#<view-id>`.

### 6.1 Customer Experience Manager (CXM)

1. **Start at** `#cx-command` — read unified financial + sentiment + next steps; note mock jumps to VoC and journeys.  
2. **Open** `#sentiment` — review CSAT/NPS and escalation threads; cite VoC integration table in external workshops.  
3. **Open** `#journeys` — tie journey strain to infra incidents for storytelling.  
4. **Use** `#cx-role-actions` — filter mentally to CXM row cards for QBR “what to do this week.”  
5. **Optional:** `#properties` for venue-level adoption; `#sdcroles` for broader SDC alignment.

### 6.2 Customer Delivery Architect (CDA)

1. **Start at** `#integrations` — wave grid + API builds matrix for gate order.  
2. **Open** `#consoles` — prove console-to-wave mapping and API-only parity.  
3. **Open** `#mvp-journey` — journey phase placement per wave; CSPC/IQ deep panels for trust narratives.  
4. **Open** `#sources` — credential posture and schedules (with platform admin).  
5. **Drill** `#devices` / `#security` when discussing assurance and exposure.

### 6.3 Project / Program Manager (PM)

1. **Start at** `#overview` — KPIs + quick actions + sync strip for executive stand-ups.  
2. **Open** `#powerbi-pm` — RAID/milestone/financial surfaces; open live embed when configured.  
3. **Open** `#cx-command` — ranked next steps and financial table for steering committees.  
4. **Open** `#properties` — regional readiness and wave tags.  
5. **Use** `#fieldnotes` / `#security` for CAB and change-freeze arguments.

### 6.4 Service Delivery Manager (SDM)

1. **Live at** `#incidents` and `#overview` — queue depth, P1/P2, TAC linkage.  
2. **Run** `#sources` — enablement, health, checklist vs `.env`.  
3. **Cross-check** `#integrations` advisor strip + `#sources` for yellow waves.  
4. **Escalate CX** via `#sentiment` and `#cx-command` when VoC and operations diverge.  
5. **Field / hardware** loops: `#fieldnotes`, `#devices`, `#security`.

### 6.5 Engineer / NetEng

1. **Primary:** `#incidents`, `#devices`, `#security`, `#fieldnotes`.  
2. Use **DNA / FMC / ISE** mock actions from `#overview` quick clusters as runbook placeholders.  
3. **TAC correlation** on Incidents view for bridge discipline.

### 6.6 Renewals / Customer Success (Renewals)

1. **Anchor** `#cx-command` — ACV/renewal risk mock KPIs and “export renewals brief” (mock).  
2. **Support** with `#properties` and `#sentiment` for venue-level story.  
3. **Power BI** `#powerbi-pm` when financial slide deck is embedded.

### 6.7 High Touch Operations Manager (HTOM)

1. **Single pane:** `#cx-command` + `#overview` for integration trust and exec escalation.  
2. **Persona view** `#sdcroles` — HTOM card in recommended next steps when Live/mock snapshot includes operations load.  
3. **Prove observability:** `#integrations` W5–W7 + Sources schedules.

---

## 7. Exporting this document to PDF

**Recommended — print-ready HTML (no Puppeteer):**

```bash
cd helix-sdm
npm install   # once, if node_modules is missing
npm run docs:helix-mockup-reference-html
```

Open `docs/HELIX_MOCKUP_REFERENCE_PRINT.html` in Chrome / Edge / Safari, then **Print → Save as PDF** (optional: enable **Background graphics**).

**Alternative — md-to-pdf (Chromium via Puppeteer):**

```bash
npm run docs:helix-mockup-reference-pdf
```

Writes `docs/HELIX_MOCKUP_REFERENCE.pdf` next to this repo when the toolchain can download Chromium.

**Other:** Pandoc, or any Markdown preview’s **Print → Save as PDF**.

---

## 8. Revision history

| Version | Notes |
| --- | --- |
| 0.7 | Initial combined reference: all 16 views, registry summary, role playbook, export instructions. |

---

*End of document.*
