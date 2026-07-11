import { Box, Typography, CircularProgress, Alert, Grid, Card, CardContent, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface CustomerHealthScore {
  customer_id: string;
  customer_name: string;
  health_score: number;
  adoption_score: number;
  engagement_score: number;
  risk_level: "green" | "yellow" | "red";
  last_updated: string;
}

interface CxKpi {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "flat";
}

const RISK_COLOR: Record<string, "success" | "warning" | "error"> = {
  green: "success",
  yellow: "warning",
  red: "error",
};

export function ExperienceCommandPage() {
  const [customers, setCustomers] = useState<CustomerHealthScore[]>([]);
  const [kpis, setKpis] = useState<CxKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<CustomerHealthScore[]>("/cx/health"),
      apiGet<CxKpi[]>("/cx/kpis"),
    ])
      .then(([c, k]) => { setCustomers(c); setKpis(k); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>CX Experience Command</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <>
          {kpis.length > 0 && (
            <Grid container spacing={2} mb={3}>
              {kpis.map((kpi) => (
                <Grid item xs={6} sm={3} key={kpi.label}>
                  <Card>
                    <CardContent>
                      <Typography variant="h5" fontWeight={700}>
                        {kpi.value}{kpi.unit ?? ""}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{kpi.label}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Adoption</TableCell>
                  <TableCell>Engagement</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.length === 0 && (
                  <TableRow><TableCell colSpan={6}>No customer data available.</TableCell></TableRow>
                )}
                {customers.map((c) => (
                  <TableRow key={c.customer_id} hover>
                    <TableCell>{c.customer_name}</TableCell>
                    <TableCell sx={{ width: 120 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={c.health_score}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption">{c.health_score}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{c.adoption_score}</TableCell>
                    <TableCell>{c.engagement_score}</TableCell>
                    <TableCell>
                      <Chip label={c.risk_level.toUpperCase()} color={RISK_COLOR[c.risk_level]} size="small" />
                    </TableCell>
                    <TableCell>{new Date(c.last_updated).toLocaleDateString()}</TableCell>
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
