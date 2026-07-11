# Helix — Build Statistics

## Codebase Scale

| Metric | Value |
|---|---|
| **Total lines of code** | **91,509** |
| **Total source files** (excl node_modules, .git, lockfiles) | **6,903** |
| **Repo size on disk** (excl deps/git) | **16.7 MB** |

## Lines of Code by Component

| Component | Lines |
|---|---|
| Mockup index.html (main UI) | ~5,400 |
| Mockup mockup-hub.js (logic + data) | ~4,580 |
| Mockup helix-logo-variants.html | 1,043 |
| Backend TypeScript (src/) | 6,342 |
| Frontend React TSX/TS | 659 |
| SVG logo assets (782 files) | 32,730 |
| Markdown documentation | 13,771 |
| SQL (seeds + migrations) | 502 |
| YAML/YML (CI + infra) | 585 |
| Logo generation scripts (Python) | 859 |
| Power BI embed (HTML + JS) | 167 |

## Backend Architecture

| Metric | Value |
|---|---|
| **API route handlers** | 34 |
| **Unique API endpoints** | 18 |
| **Integration clients** (Salesforce, DNA Center, TAC, Smart Licensing, Webex, Support API) | 6 (381 LOC) |
| **Middleware modules** (auth, audit, helmet) | 3 (141 LOC) |
| **Services** (Power BI embed) | 1 (104 LOC) |
| **NPM dependencies** | 11 prod + 13 dev |
| **npm scripts** | 8 (dev, build, start, migrate, seed-passwords, lint, lint:fix, test) |

## Frontend

| Metric | Value |
|---|---|
| **React pages** | 7 (Login, Dashboard, Devices, Incidents, Properties, Power BI PM, Salesforce) |
| **NPM dependencies** | 8 prod + 9 dev |

## Mockup UI (Visual Hub)

| Metric | Value |
|---|---|
| **Views / pages** | 19 |
| **Navigation items** | 19 |
| **KPI cards** | 104 |
| **Data tables** | 38 |
| **Panels** | 74 |
| **Digitized Delivery callouts** | 12 |
| **Salesforce CRM panels** | 14 |
| **Helix logo SVG variants** | 782 files |

## Infrastructure & CI

| Metric | Value |
|---|---|
| **CI/CD workflows** (GitHub Actions) | 3 |
| **Docker services** (compose) | PostgreSQL, Redis, Backend, Frontend |
| **Database schemas** | 3 (mgm, cisco, audit) |

## Documentation

| Metric | Value |
|---|---|
| **Requirements doc** | 868 lines (1.3 MB PDF) |
| **README** | 567 lines |
| **Cisco Data Sources doc** | multi-copy, synced |
| **MVP Scope Freeze doc** | multi-copy, synced |

## Git History

| Metric | Value |
|---|---|
| **Committed insertions** | 50,973 |
| **Uncommitted changes** (working tree) | 26 files changed, +11,724 / -921 |
| **Untracked new files** | 817 |
| **Total files in repo** (tracked + untracked) | 973 |
| **Initial commit date** | Apr 4, 2026 |

## Session & Conversation Stats

| Metric | Value |
|---|---|
| **Conversation transcript** | 3.3 MB, ~2,346 message events |
| **Estimated tokens processed** | **~854,000** |
| **User requests in session** | 6 major requests |
| **Completed TODO items** | 17 (12 audit fixes + 5 blue light filter) |

## Accessibility Features

- Theme: light / dark / system / daylight-auto
- Contrast: standard / soft / high
- Text scaling: 90% / 100% / 115% / 130%
- Reduce motion (manual + OS prefers-reduced-motion)
- Blue light filter: off / low / medium / high
- Full ARIA: skip links, live regions, keyboard navigation, drag reorder
- WCAG 2.1 AA targeted

---

*Generated April 6, 2026 — Helix*
