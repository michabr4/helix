import { Box, Typography, CircularProgress, Alert, Card, CardContent, Grid, Chip, Table, TableBody, TableCell, TableHead, TableRow, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface PsirtAdvisory {
  advisory_id: string;
  title: string;
  severity: string;
  cvss_score: number | null;
  affected_products: string[];
  published_at: string;
  status: string;
}

export function SecurityPage() {
  const [advisories, setAdvisories] = useState<PsirtAdvisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PsirtAdvisory[]>("/security/psirt")
      .then(setAdvisories)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const severityColor = (s: string): "error" | "warning" | "info" | "default" => {
    if (s === "Critical") return "error";
    if (s === "High") return "error";
    if (s === "Medium") return "warning";
    if (s === "Low") return "info";
    return "default";
  };

  const critical = advisories.filter(a => a.severity === "Critical" || a.severity === "High").length;
  const medium = advisories.filter(a => a.severity === "Medium").length;
  const low = advisories.filter(a => a.severity === "Low").length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Security Advisories (PSIRT)</Typography>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: "4px solid #d32f2f" }}>
                <CardContent>
                  <Typography variant="h4">{critical}</Typography>
                  <Typography color="text.secondary">Critical / High</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: "4px solid #ed6c02" }}>
                <CardContent>
                  <Typography variant="h4">{medium}</Typography>
                  <Typography color="text.secondary">Medium</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: "4px solid #0288d1" }}>
                <CardContent>
                  <Typography variant="h4">{low}</Typography>
                  <Typography color="text.secondary">Low</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Advisory ID</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>CVSS</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Published</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {advisories.length === 0 && (
                  <TableRow><TableCell colSpan={6}>No advisories found.</TableCell></TableRow>
                )}
                {advisories.map((a) => (
                  <TableRow key={a.advisory_id} hover>
                    <TableCell>{a.advisory_id}</TableCell>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>
                      <Chip label={a.severity} color={severityColor(a.severity)} size="small" />
                    </TableCell>
                    <TableCell>{a.cvss_score ?? "N/A"}</TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell>{new Date(a.published_at).toLocaleDateString()}</TableCell>
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
