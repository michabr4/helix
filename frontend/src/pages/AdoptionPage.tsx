import { Box, Typography, CircularProgress, Alert, Card, CardContent, Grid, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface Deployment {
  adoption_id: string;
  property_name: string;
  technology_name: string;
  technology_category: string;
  deployment_phase: string | null;
  devices_deployed: number;
  health_score: string | null;
  health_status: string | null;
  updated_at: string;
}

interface LicenseUsage {
  usage_id: string;
  property_name: string;
  product_name: string;
  sku: string;
  quantity_used: number;
  quantity_purchased: number;
  utilization_pct: number;
  last_sync: string | null;
}

interface AdoptionKpis {
  total_deployments: number;
  deployments_by_phase: Record<string, number>;
  total_licenses_tracked: number;
  avg_license_utilization_pct: number;
  underutilized_license_count: number;
  near_capacity_license_count: number;
}

const PHASE_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  planning: "default",
  design: "default",
  pilot: "warning",
  deployment: "info",
  production: "success",
  complete: "success",
};

function utilizationColor(pct: number): string {
  if (pct >= 0.9) return "#ed6c02"; // near capacity — expansion opportunity
  if (pct < 0.4) return "#d32f2f"; // underutilized — adoption risk
  return "#2e7d32";
}

export function AdoptionPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [licenses, setLicenses] = useState<LicenseUsage[]>([]);
  const [kpis, setKpis] = useState<AdoptionKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Deployment[]>("/adoption/deployments"),
      apiGet<LicenseUsage[]>("/adoption/licenses"),
      apiGet<AdoptionKpis>("/adoption/kpis"),
    ])
      .then(([d, l, k]) => { setDeployments(d); setLicenses(l); setKpis(k); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Cisco Product Adoption</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && kpis && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={3}>
              <Card><CardContent>
                <Typography variant="h4">{kpis.total_deployments}</Typography>
                <Typography color="text.secondary">Tracked Deployments</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card><CardContent>
                <Typography variant="h4" sx={{ color: utilizationColor(kpis.avg_license_utilization_pct / 100) }}>
                  {kpis.avg_license_utilization_pct.toFixed(1)}%
                </Typography>
                <Typography color="text.secondary">Avg License Utilization</Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(kpis.avg_license_utilization_pct, 100)}
                  sx={{ mt: 1, "& .MuiLinearProgress-bar": { backgroundColor: utilizationColor(kpis.avg_license_utilization_pct / 100) } }}
                />
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: "4px solid #d32f2f" }}><CardContent>
                <Typography variant="h4">{kpis.underutilized_license_count}</Typography>
                <Typography color="text.secondary">Underutilized (&lt;40%) — Adoption Risk</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: "4px solid #ed6c02" }}><CardContent>
                <Typography variant="h4">{kpis.near_capacity_license_count}</Typography>
                <Typography color="text.secondary">Near Capacity (&gt;=90%) — Expansion Opportunity</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Typography variant="h6" fontWeight={600} mb={1}>Technology Deployments by Property</Typography>
          <Paper sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Technology</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Phase</TableCell>
                  <TableCell>Devices Deployed</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deployments.length === 0 && (
                  <TableRow><TableCell colSpan={7}>No adoption data recorded.</TableCell></TableRow>
                )}
                {deployments.map((d) => (
                  <TableRow key={d.adoption_id} hover>
                    <TableCell>{d.property_name}</TableCell>
                    <TableCell>{d.technology_name}</TableCell>
                    <TableCell>{d.technology_category}</TableCell>
                    <TableCell>
                      {d.deployment_phase && (
                        <Chip
                          size="small"
                          label={d.deployment_phase}
                          color={PHASE_COLOR[d.deployment_phase] ?? "default"}
                        />
                      )}
                    </TableCell>
                    <TableCell>{d.devices_deployed}</TableCell>
                    <TableCell>{d.health_status ?? "—"}</TableCell>
                    <TableCell>{new Date(d.updated_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Typography variant="h6" fontWeight={600} mb={1}>License Utilization by Property</Typography>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Used / Purchased</TableCell>
                  <TableCell>Utilization</TableCell>
                  <TableCell>Last Sync</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {licenses.length === 0 && (
                  <TableRow><TableCell colSpan={6}>No license usage data recorded.</TableCell></TableRow>
                )}
                {licenses.map((l) => (
                  <TableRow key={l.usage_id} hover>
                    <TableCell>{l.property_name}</TableCell>
                    <TableCell>{l.product_name}</TableCell>
                    <TableCell>{l.sku}</TableCell>
                    <TableCell>{l.quantity_used} / {l.quantity_purchased}</TableCell>
                    <TableCell sx={{ color: utilizationColor(l.utilization_pct), fontWeight: 700 }}>
                      {(l.utilization_pct * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>{l.last_sync ? new Date(l.last_sync).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
