import { Box, Typography, CircularProgress, Alert, Grid, Card, CardContent, CardHeader, Avatar, Chip, List, ListItem, ListItemText, Divider } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

interface AgentStatus {
  agent_id: string;
  name: string;
  role: string;
  status: "idle" | "running" | "error" | "pending_approval";
  last_run?: string;
  last_action?: string;
  pending_count: number;
}

interface ApprovalRequest {
  request_id: string;
  agent_name: string;
  action: string;
  context: string;
  requested_at: string;
}

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default" | "primary"> = {
  idle: "default",
  running: "primary",
  error: "error",
  pending_approval: "warning",
};

const ROLE_INITIALS: Record<string, string> = {
  SDM: "SD",
  PM: "PM",
  PgM: "PG",
  CSM: "CS",
  HTOM: "HT",
};

export function PersonasConsolePage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<AgentStatus[]>("/agents/status"),
      apiGet<ApprovalRequest[]>("/agents/approvals/pending"),
    ])
      .then(([a, ap]) => { setAgents(a); setApprovals(ap); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Helix Agent Console</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Typography variant="h6" mb={1}>Agent Personas</Typography>
            <Grid container spacing={2}>
              {agents.length === 0 && (
                <Grid item xs={12}>
                  <Alert severity="info">No agents registered. Deploy Helix agents to see them here.</Alert>
                </Grid>
              )}
              {agents.map((agent) => (
                <Grid item xs={12} sm={6} key={agent.agent_id}>
                  <Card>
                    <CardHeader
                      avatar={
                        <Avatar sx={{ bgcolor: "primary.main" }}>
                          {ROLE_INITIALS[agent.role] ?? agent.role.slice(0, 2).toUpperCase()}
                        </Avatar>
                      }
                      title={agent.name}
                      subheader={agent.role}
                      action={
                        <Chip
                          label={agent.status.replace("_", " ")}
                          color={STATUS_COLOR[agent.status]}
                          size="small"
                          sx={{ mt: 1, mr: 1 }}
                        />
                      }
                    />
                    <CardContent sx={{ pt: 0 }}>
                      {agent.last_action && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          Last: {agent.last_action}
                        </Typography>
                      )}
                      {agent.last_run && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(agent.last_run).toLocaleString()}
                        </Typography>
                      )}
                      {agent.pending_count > 0 && (
                        <Chip label={`${agent.pending_count} pending`} color="warning" size="small" sx={{ mt: 1 }} />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="h6" mb={1}>Pending Approvals</Typography>
            <Card>
              {approvals.length === 0 ? (
                <CardContent>
                  <Typography color="text.secondary">No pending approvals.</Typography>
                </CardContent>
              ) : (
                <List dense>
                  {approvals.map((ap, i) => (
                    <Box key={ap.request_id}>
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={`${ap.agent_name} — ${ap.action}`}
                          secondary={
                            <>
                              <Typography variant="caption" display="block">{ap.context}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(ap.requested_at).toLocaleString()}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                      {i < approvals.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
