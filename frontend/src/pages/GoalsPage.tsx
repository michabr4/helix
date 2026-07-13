import { Box, Typography, CircularProgress, Alert, Card, CardContent, Grid, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface KeyResult {
  kr_id: string;
  title: string;
  metric_type: string;
  unit: string | null;
  start_value: number;
  current_value: number;
  target_value: number;
  updated_at: string;
}

interface Goal {
  goal_id: string;
  title: string;
  description: string | null;
  category: string;
  owner: string | null;
  status: string;
  start_date: string;
  target_date: string;
  key_results: KeyResult[];
  progress_pct: number;
}

interface GoalsSummary {
  total_goals: number;
  by_status: Record<string, number>;
  avg_progress_pct: number;
  overdue_goal_count: number;
}

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  on_track: "success",
  at_risk: "warning",
  off_track: "error",
  completed: "default",
};

const CATEGORY_COLOR: Record<string, "default" | "info" | "secondary" | "primary"> = {
  customer: "info",
  team: "primary",
  financial: "secondary",
  operational: "default",
};

function progressColor(pct: number): string {
  if (pct >= 75) return "#2e7d32";
  if (pct >= 40) return "#ed6c02";
  return "#d32f2f";
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Goal[]>("/goals"),
      apiGet<GoalsSummary>("/goals/summary"),
    ])
      .then(([g, s]) => { setGoals(g); setSummary(s); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Goals &amp; Loops</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && summary && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={3}>
              <Card><CardContent>
                <Typography variant="h4">{summary.total_goals}</Typography>
                <Typography color="text.secondary">Active Goals</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card><CardContent>
                <Typography variant="h4" sx={{ color: progressColor(summary.avg_progress_pct) }}>
                  {summary.avg_progress_pct.toFixed(1)}%
                </Typography>
                <Typography color="text.secondary">Avg Progress</Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(summary.avg_progress_pct, 100)}
                  sx={{ mt: 1, "& .MuiLinearProgress-bar": { backgroundColor: progressColor(summary.avg_progress_pct) } }}
                />
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: "4px solid #ed6c02" }}><CardContent>
                <Typography variant="h4">{summary.by_status["at_risk"] ?? 0}</Typography>
                <Typography color="text.secondary">At Risk</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: "4px solid #d32f2f" }}><CardContent>
                <Typography variant="h4">{summary.overdue_goal_count}</Typography>
                <Typography color="text.secondary">Overdue</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Typography variant="h6" fontWeight={600} mb={1}>Goals</Typography>
          <Paper sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Key Results</TableCell>
                  <TableCell>Target Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {goals.length === 0 && (
                  <TableRow><TableCell colSpan={7}>No goals recorded.</TableCell></TableRow>
                )}
                {goals.map((g) => (
                  <TableRow key={g.goal_id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{g.title}</Typography>
                      {g.description && (
                        <Typography variant="caption" color="text.secondary">{g.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={g.category} color={CATEGORY_COLOR[g.category] ?? "default"} />
                    </TableCell>
                    <TableCell>{g.owner ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" label={g.status.replace("_", " ")} color={STATUS_COLOR[g.status] ?? "default"} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Typography variant="body2" sx={{ color: progressColor(g.progress_pct), fontWeight: 700 }}>
                        {g.progress_pct.toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(g.progress_pct, 100)}
                        sx={{ "& .MuiLinearProgress-bar": { backgroundColor: progressColor(g.progress_pct) } }}
                      />
                    </TableCell>
                    <TableCell>
                      {g.key_results.length === 0 && "—"}
                      {g.key_results.map((kr) => (
                        <Typography key={kr.kr_id} variant="caption" component="div">
                          {kr.title}: {kr.current_value}{kr.unit ?? ""} / {kr.target_value}{kr.unit ?? ""}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell>{new Date(g.target_date).toLocaleDateString()}</TableCell>
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
