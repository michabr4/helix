import { Alert, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

type Property = {
  property_id: string;
  name: string;
  property_type: string;
};

export function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Property[]>("/properties")
      .then(setProperties)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <>
      <Typography variant="h5" gutterBottom>Properties</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <List>
        {properties.map((p) => (
          <ListItem key={p.property_id}>
            <ListItemText primary={p.name} secondary={p.property_type} />
          </ListItem>
        ))}
      </List>
    </>
  );
}
