import { Box, Typography, CircularProgress, Alert, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface TacCase {
  case_id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  customer_name?: string;
}

export function TacCasesPage() {
  const [cases, setCases] = useState<TacCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<TacCase[]>("/tac-cases")
      .then(setCases)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const severityColor = (s: string) => {
    if (s === "1" || s === "2") return "error";
    if (s === "3") return "warning";
    return "default";
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>TAC Cases</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Case ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.length === 0 && (
                <TableRow><TableCell colSpan={6}>No TAC cases found.</TableCell></TableRow>
              )}
              {cases.map((c) => (
                <TableRow key={c.case_id} hover>
                  <TableCell>{c.case_id}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>
                    <Chip label={`SEV${c.severity}`} color={severityColor(c.severity) as "error"|"warning"|"default"} size="small" />
                  </TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>{c.customer_name ?? "—"}</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
