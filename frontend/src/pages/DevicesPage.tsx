import { Alert, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet } from "../api";

type Device = {
  device_id: string;
  hostname: string;
  ip_address: string;
  status: string;
};

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Device[]>("/devices")
      .then(setDevices)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <>
      <Typography variant="h5" gutterBottom>Devices</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <List>
        {devices.map((d) => (
          <ListItem key={d.device_id}>
            <ListItemText primary={d.hostname} secondary={`${d.ip_address} | ${d.status}`} />
          </ListItem>
        ))}
      </List>
    </>
  );
}
