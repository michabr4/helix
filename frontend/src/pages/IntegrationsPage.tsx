import { Box, Typography, CircularProgress, Alert, Grid, Card, CardContent, CardHeader, Chip, Switch, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface IntegrationSource {
  source_id: string;
  source_type: string;
  display_name: string;
  enabled: boolean;
  last_synced?: string;
  sync_status?: "success" | "error" | "running" | "never";
  error_message?: string;
  cron_expression?: string;
}

interface SyncLog {
  log_id: string;
  source_type: string;
  started_at: string;
  finished_at?: string;
  status: string;
  records_synced: number;
  error_message?: string;
}

export function IntegrationsPage() {
  const [sources, setSources] = useState<IntegrationSource[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<IntegrationSource[]>("/integrations/sources"),
      apiGet<SyncLog[]>("/integrations/logs"),
    ])
      .then(([s, l]) => { setSources(s); setLogs(l); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const syncStatusColor = (s?: string): "success" | "error" | "warning" | "default" => {
    if (s === "success") return "success";
    if (s === "error") return "error";
    if (s === "running") return "warning";
    return "default";
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Integrations</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <>
          <Grid container spacing={2} mb={4}>
            {sources.length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">No integration sources configured.</Alert>
              </Grid>
            )}
            {sources.map((src) => (
              <Grid item xs={12} sm={6} md={4} key={src.source_id}>
                <Card>
                  <CardHeader
                    title={src.display_name}
                    subheader={src.source_type}
                    action={
                      <FormControlLabel
                        control={<Switch checked={src.enabled} size="small" />}
                        label=""
                        sx={{ m: 0 }}
                      />
                    }
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip
                        label={src.sync_status ?? "never"}
                        color={syncStatusColor(src.sync_status)}
                        size="small"
                      />
                      {src.cron_expression && (
                        <Chip label={src.cron_expression} size="small" variant="outlined" />
                      )}
                    </Box>
                    {src.last_synced && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                        Last synced: {new Date(src.last_synced).toLocaleString()}
                      </Typography>
                    )}
                    {src.error_message && (
                      <Typography variant="caption" color="error" display="block" mt={0.5} noWrap>
                        {src.error_message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h6" mb={1}>Sync History</Typography>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Records</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={5}>No sync history.</TableCell></TableRow>
                )}
                {logs.map((log) => {
                  const duration = log.finished_at
                    ? `${Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                    : "—";
                  return (
                    <TableRow key={log.log_id} hover>
                      <TableCell>{log.source_type}</TableCell>
                      <TableCell>{new Date(log.started_at).toLocaleString()}</TableCell>
                      <TableCell>{duration}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          color={log.status === "success" ? "success" : log.status === "error" ? "error" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{log.records_synced}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
