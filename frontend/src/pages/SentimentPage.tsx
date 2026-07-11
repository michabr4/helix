import { Box, Typography, CircularProgress, Alert, Card, CardContent, Grid, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface VocSignal {
  signal_id: string;
  source: string;
  sentiment_score: number;
  summary: string;
  recorded_at: string;
  customer_name?: string;
}

interface SentimentSummary {
  avg_score: number;
  total_signals: number;
  positive: number;
  neutral: number;
  negative: number;
}

export function SentimentPage() {
  const [signals, setSignals] = useState<VocSignal[]>([]);
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<VocSignal[]>("/voc/signals"),
      apiGet<SentimentSummary>("/voc/summary"),
    ])
      .then(([sigs, sum]) => { setSignals(sigs); setSummary(sum); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const scoreColor = (score: number) => {
    if (score >= 7) return "#2e7d32";
    if (score >= 4) return "#ed6c02";
    return "#d32f2f";
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Customer Sentiment & VoC</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && summary && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" sx={{ color: scoreColor(summary.avg_score) }}>
                    {summary.avg_score.toFixed(1)}
                  </Typography>
                  <Typography color="text.secondary">Avg Sentiment (0–10)</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={summary.avg_score * 10}
                    sx={{ mt: 1, "& .MuiLinearProgress-bar": { backgroundColor: scoreColor(summary.avg_score) } }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card><CardContent>
                <Typography variant="h4">{summary.total_signals}</Typography>
                <Typography color="text.secondary">Total Signals</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Card sx={{ borderLeft: "4px solid #2e7d32" }}><CardContent>
                <Typography variant="h4">{summary.positive}</Typography>
                <Typography color="text.secondary">Positive</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Card sx={{ borderLeft: "4px solid #ed6c02" }}><CardContent>
                <Typography variant="h4">{summary.neutral}</Typography>
                <Typography color="text.secondary">Neutral</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Card sx={{ borderLeft: "4px solid #d32f2f" }}><CardContent>
                <Typography variant="h4">{summary.negative}</Typography>
                <Typography color="text.secondary">Negative</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Summary</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {signals.length === 0 && (
                  <TableRow><TableCell colSpan={5}>No signals recorded.</TableCell></TableRow>
                )}
                {signals.map((s) => (
                  <TableRow key={s.signal_id} hover>
                    <TableCell>{s.source}</TableCell>
                    <TableCell sx={{ color: scoreColor(s.sentiment_score), fontWeight: 700 }}>
                      {s.sentiment_score.toFixed(1)}
                    </TableCell>
                    <TableCell>{s.summary}</TableCell>
                    <TableCell>{s.customer_name ?? "—"}</TableCell>
                    <TableCell>{new Date(s.recorded_at).toLocaleDateString()}</TableCell>
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
