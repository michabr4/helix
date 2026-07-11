import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@serviceflow.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "ChangeMe123!" : "");
  const [error, setError] = useState(() => {
    // Show a friendly message if the SSO exchange failed (e.g. code expired)
    const params = new URLSearchParams(window.location.search);
    return params.get("error") === "sso_failed"
      ? "SSO sign-in failed or the session expired. Please try again."
      : "";
  });

  return (
    <Stack spacing={2} sx={{ maxWidth: 420, mt: 6 }}>
      <Typography variant="h5">Login</Typography>
      <Typography variant="body2" color="text.secondary">
        This dev app uses its own browser storage. To use mockup <strong>Live data</strong> at{" "}
        <code>/mockup/</code>, sign in again on the Operations page at{" "}
        <code>http://localhost:3000/</code> (same JWT is not shared across ports).
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Box>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              await login(email, password);
              navigate("/dashboard");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Sign in
        </Button>
      </Box>
    </Stack>
  );
}
