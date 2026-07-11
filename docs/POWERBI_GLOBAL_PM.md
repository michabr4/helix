# Power BI — Global PM Dashboard (embed)

Service Delivery Manager can embed a **Power BI report** (your “Global PM Dashboard”) in:

- **`/powerbi-pm.html`** — static shell + `powerbi-client` (JWT required)
- **`GET /api/v1/analytics/powerbi/embed`** — JSON embed context for custom clients (JWT required)

## Prerequisites (Microsoft)

1. **Power BI tenant** with the report published to a workspace.
2. **Azure AD app registration** (service principal):
   - Application (client) ID, directory (tenant) ID, client secret.
   - API permission: **Power BI Service → Tenant.Read.All** (application) or as required by your org; admin consent.
3. **Enable service principal** for Power BI admin settings (tenant setting: *Developer settings → Service principals can use Power BI APIs*).
4. **Workspace access**: add the service principal to the workspace as **Admin** or **Member** (Power BI portal → workspace → access).

## Backend environment variables

| Variable | Description |
|----------|-------------|
| `POWERBI_ENABLED` | `true` to turn on embed generation |
| `POWERBI_TENANT_ID` | Azure AD tenant ID |
| `POWERBI_CLIENT_ID` | App registration client ID |
| `POWERBI_CLIENT_SECRET` | App registration secret |
| `POWERBI_WORKSPACE_ID` | Power BI workspace (group) GUID |
| `POWERBI_REPORT_ID` | Report GUID |

Never commit secrets. Use Key Vault / environment injection in production.

## RLS and “Global PM” data

If the semantic model uses **Row-Level Security**, define roles that match how your SP or effective identity should see data. App-only embed tokens use the service principal identity unless you implement **effective identity** (advanced; see Power BI REST docs).

## Typical Global PM dashboard content

Align the report pages with program management needs:

- Portfolio RAID (risks, actions, issues, decisions) by region / wave  
- Milestones and dependency views vs MVP wave gates  
- Financial roll-up (ACV, TCV, burndown) tied to accounts / properties  
- Resource & capacity heatmaps  
- Executive summary with drill-through to account or site  

Helix links VoC, incidents, and integrations in other panes; Power BI remains the PM analytics layer.

## Troubleshooting

- **502 from embed API** — check AAD secret expiry, SP workspace access, and `GenerateToken` permissions.  
- **Empty iframe / script errors** — open browser console; confirm CSP allows `app.powerbi.com` (this repo uses a dedicated helmet profile for `/powerbi-pm.html`).  
- **401 on embed API** — sign in on `/` and ensure JWT `role` is allowed (admin, manager, sdm, tam, csm, engineer, viewer).
