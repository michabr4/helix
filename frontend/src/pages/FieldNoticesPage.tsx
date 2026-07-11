import { Box, Typography, CircularProgress, Alert, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface FieldNotice {
  fn_id: string;
  title: string;
  affected_products: string[];
  workaround_available: boolean;
  published_at: string;
  url?: string;
}

export function FieldNoticesPage() {
  const [notices, setNotices] = useState<FieldNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<FieldNotice[]>("/security/field-notices")
      .then(setNotices)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Field Notices</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>FN ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Affected Products</TableCell>
                <TableCell>Workaround</TableCell>
                <TableCell>Published</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notices.length === 0 && (
                <TableRow><TableCell colSpan={5}>No field notices found.</TableCell></TableRow>
              )}
              {notices.map((fn) => (
                <TableRow key={fn.fn_id} hover>
                  <TableCell>
                    {fn.url ? (
                      <a href={fn.url} target="_blank" rel="noreferrer">{fn.fn_id}</a>
                    ) : fn.fn_id}
                  </TableCell>
                  <TableCell>{fn.title}</TableCell>
                  <TableCell>{fn.affected_products.slice(0, 3).join(", ")}{fn.affected_products.length > 3 ? ` +${fn.affected_products.length - 3}` : ""}</TableCell>
                  <TableCell>
                    <Chip
                      label={fn.workaround_available ? "Yes" : "No"}
                      color={fn.workaround_available ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(fn.published_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
