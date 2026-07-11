import { Alert, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

type Incident = {
  incident_id: string;
  incident_number: string;
  title: string;
  priority: string;
  status: string;
};

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Incident[]>("/incidents")
      .then(setIncidents)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <>
      <Typography variant="h5" gutterBottom>Incidents</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <List>
        {incidents.map((i) => (
          <ListItem key={i.incident_id}>
            <ListItemText
              primary={`${i.incident_number} - ${i.title}`}
              secondary={`Priority ${i.priority} | ${i.status}`}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
