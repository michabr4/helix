import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid2,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

type SfRecord = Record<string, unknown> & { Id: string };
type SfResponse = { configured: boolean; totalSize?: number; records: SfRecord[]; message?: string };

type ConsoleSummary = {
  configured: boolean;
  message?: string;
  pm?: { totalAccounts: number; activeOpportunities: number; pipelineValue: number; closedWonCount: number; openTasks: number };
  delivery?: { openCases: number; highPriorityCases: number; totalCases: number };
  success?: { totalAccounts: number; activeEntitlements: number; openTasks: number };
  renewals?: { totalEntitlements: number; activeEntitlements: number; expiringIn90Days: number; pipelineValue: number; pipelineCount: number };
  architect?: { totalAccounts: number; totalCases: number };
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return o.Name ? String(o.Name) : JSON.stringify(v);
  }
  return String(v);
}

function currency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
        <Typography variant="h4">{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

export function SalesforcePage() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState<ConsoleSummary | null>(null);
  const [cases, setCases] = useState<SfResponse | null>(null);
  const [accounts, setAccounts] = useState<SfResponse | null>(null);
  const [opps, setOpps] = useState<SfResponse | null>(null);
  const [entitlements, setEntitlements] = useState<SfResponse | null>(null);
  const [contacts, setContacts] = useState<SfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<ConsoleSummary>("/salesforce/console-summary"),
      apiGet<SfResponse>("/salesforce/cases?limit=50"),
      apiGet<SfResponse>("/salesforce/accounts?limit=50"),
      apiGet<SfResponse>("/salesforce/opportunities?limit=50"),
      apiGet<SfResponse>("/salesforce/entitlements?limit=50"),
      apiGet<SfResponse>("/salesforce/contacts?limit=50")
    ])
      .then(([s, c, a, o, e, co]) => {
        setSummary(s);
        setCases(c);
        setAccounts(a);
        setOpps(o);
        setEntitlements(e);
        setContacts(co);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (summary && !summary.configured) {
    return (
      <Alert severity="info">
        {summary.message ?? "Salesforce is not configured. Set SALESFORCE_* environment variables on the backend."}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Salesforce CRM</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Live Salesforce data powering all SDC program consoles — Cases, Accounts, Opportunities, Entitlements, and Contacts.
      </Typography>

      {summary?.pm && (
        <Grid2 container spacing={2} sx={{ mb: 3 }}>
          <Grid2 size={{ xs: 12, sm: 6, md: 2.4 }}>
            <KpiCard label="Accounts" value={summary.pm.totalAccounts} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, md: 2.4 }}>
            <KpiCard label="Open Cases" value={summary.delivery?.openCases ?? 0} sub={`${summary.delivery?.highPriorityCases ?? 0} high priority`} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, md: 2.4 }}>
            <KpiCard label="Pipeline" value={currency(summary.pm.pipelineValue)} sub={`${summary.pm.activeOpportunities} active`} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, md: 2.4 }}>
            <KpiCard label="Entitlements" value={summary.renewals?.activeEntitlements ?? 0} sub={`${summary.renewals?.expiringIn90Days ?? 0} expiring in 90d`} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, md: 2.4 }}>
            <KpiCard label="Open Tasks" value={summary.pm.openTasks} />
          </Grid2>
        </Grid2>
      )}

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Cases" />
          <Tab label="Accounts" />
          <Tab label="Opportunities" />
          <Tab label="Entitlements" />
          <Tab label="Contacts" />
        </Tabs>
      </Box>

      {tab === 0 && cases && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Case #</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.records.map((r) => (
                <TableRow key={r.Id}>
                  <TableCell>{fmt(r.CaseNumber)}</TableCell>
                  <TableCell>{fmt(r.Subject)}</TableCell>
                  <TableCell><Chip label={fmt(r.Status)} size="small" color={r.Status === "Closed" ? "default" : "warning"} /></TableCell>
                  <TableCell>{fmt(r.Priority)}</TableCell>
                  <TableCell>{fmt(r.Account)}</TableCell>
                  <TableCell>{fmt(r.Owner)}</TableCell>
                  <TableCell>{fmt(r.CreatedDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && accounts && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Industry</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>City</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.records.map((r) => (
                <TableRow key={r.Id}>
                  <TableCell>{fmt(r.Name)}</TableCell>
                  <TableCell>{fmt(r.Type)}</TableCell>
                  <TableCell>{fmt(r.Industry)}</TableCell>
                  <TableCell>{r.AnnualRevenue ? currency(Number(r.AnnualRevenue)) : "—"}</TableCell>
                  <TableCell>{fmt(r.Owner)}</TableCell>
                  <TableCell>{fmt(r.BillingCity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && opps && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Close Date</TableCell>
                <TableCell>Probability</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Owner</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {opps.records.map((r) => (
                <TableRow key={r.Id}>
                  <TableCell>{fmt(r.Name)}</TableCell>
                  <TableCell><Chip label={fmt(r.StageName)} size="small" color={r.StageName === "Closed Won" ? "success" : r.StageName === "Closed Lost" ? "error" : "info"} /></TableCell>
                  <TableCell>{r.Amount ? currency(Number(r.Amount)) : "—"}</TableCell>
                  <TableCell>{fmt(r.CloseDate)}</TableCell>
                  <TableCell>{r.Probability ? `${r.Probability}%` : "—"}</TableCell>
                  <TableCell>{fmt(r.Account)}</TableCell>
                  <TableCell>{fmt(r.Owner)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 3 && entitlements && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Remaining Cases</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entitlements.records.map((r) => (
                <TableRow key={r.Id}>
                  <TableCell>{fmt(r.Name)}</TableCell>
                  <TableCell><Chip label={fmt(r.Status)} size="small" color={r.Status === "Active" ? "success" : "default"} /></TableCell>
                  <TableCell>{fmt(r.Account)}</TableCell>
                  <TableCell>{fmt(r.StartDate)}</TableCell>
                  <TableCell>{fmt(r.EndDate)}</TableCell>
                  <TableCell>{fmt(r.RemainingCases)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 4 && contacts && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Phone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.records.map((r) => (
                <TableRow key={r.Id}>
                  <TableCell>{`${fmt(r.FirstName)} ${fmt(r.LastName)}`}</TableCell>
                  <TableCell>{fmt(r.Email)}</TableCell>
                  <TableCell>{fmt(r.Title)}</TableCell>
                  <TableCell>{fmt(r.Department)}</TableCell>
                  <TableCell>{fmt(r.Account)}</TableCell>
                  <TableCell>{fmt(r.Phone)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
