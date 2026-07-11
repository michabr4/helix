import { Box, Typography, CircularProgress, Alert, Card, CardContent, Grid, Stepper, Step, StepLabel, StepContent, Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface JourneyMilestone {
  milestone_id: string;
  name: string;
  phase: string;
  status: "completed" | "in_progress" | "pending" | "at_risk";
  target_date: string;
  completed_date?: string;
  owner?: string;
  notes?: string;
}

interface JourneyData {
  customer_name: string;
  lifecycle_stage: string;
  health_score: number;
  milestones: JourneyMilestone[];
}

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default" | "primary"> = {
  completed: "success",
  in_progress: "primary",
  at_risk: "error",
  pending: "default",
};

export function JourneyPage() {
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<JourneyData>("/journey")
      .then(setJourney)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeStep = journey?.milestones.findIndex(m => m.status === "in_progress") ?? 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Customer Journey</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && journey && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{journey.customer_name}</Typography>
                  <Typography color="text.secondary">Customer</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{journey.lifecycle_stage}</Typography>
                  <Typography color="text.secondary">Lifecycle Stage</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: `4px solid ${journey.health_score >= 70 ? "#2e7d32" : journey.health_score >= 40 ? "#ed6c02" : "#d32f2f"}` }}>
                <CardContent>
                  <Typography variant="h4">{journey.health_score}</Typography>
                  <Typography color="text.secondary">Health Score</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Stepper activeStep={activeStep} orientation="vertical">
            {journey.milestones.map((m) => (
              <Step key={m.milestone_id} completed={m.status === "completed"}>
                <StepLabel
                  optional={<Typography variant="caption">{m.phase}</Typography>}
                  error={m.status === "at_risk"}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {m.name}
                    <Chip label={m.status.replace("_", " ")} color={STATUS_COLOR[m.status]} size="small" />
                  </Box>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Target: {new Date(m.target_date).toLocaleDateString()}
                    {m.completed_date && ` · Completed: ${new Date(m.completed_date).toLocaleDateString()}`}
                    {m.owner && ` · Owner: ${m.owner}`}
                  </Typography>
                  {m.notes && <Typography variant="body2" mt={0.5}>{m.notes}</Typography>}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </>
      )}
      {!loading && !error && !journey && (
        <Alert severity="info">No journey data available.</Alert>
      )}
    </Box>
  );
}
