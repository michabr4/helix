import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { factories, models, service } from "powerbi-client";
import { useEffect, useRef, useState } from "react";
import { fetchPowerBiEmbed, type PowerBiEmbedResponse } from "../api";

const powerbiService = new service.Service(
  factories.hpmFactory,
  factories.wpmpFactory,
  factories.routerFactory
);

export function PowerBiPmDashboardPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PowerBiEmbedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPowerBiEmbed();
        if (!cancelled) {
          setData(res);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load embed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || !("enabled" in data) || data.enabled !== true || !hostRef.current) return;
    const el = hostRef.current;
    el.innerHTML = "";
    let embedded: ReturnType<typeof powerbiService.embed> | null = null;
    try {
      embedded = powerbiService.embed(el, {
        type: "report",
        id: data.reportId,
        embedUrl: data.embedUrl,
        accessToken: data.embedToken,
        tokenType: models.TokenType.Embed,
        settings: {
          panes: {
            filters: { expanded: false, visible: true },
            pageNavigation: { visible: true }
          }
        }
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Embed failed");
    }
    return () => {
      if (embedded) {
        try { powerbiService.reset(el); } catch { /* already disposed */ }
      }
    };
  }, [data]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (err) {
    return <Alert severity="error">{err}</Alert>;
  }

  if (!data) {
    return <Alert severity="warning">No response from embed API.</Alert>;
  }

  if (!data.enabled) {
    return (
      <Alert severity="info">
        {data.message ??
          "Power BI is not configured. Set POWERBI_* on the backend (see docs/POWERBI_GLOBAL_PM.md)."}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Global PM Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {data.reportName} · token expires {data.tokenExpiry}
      </Typography>
      <Box
        ref={hostRef}
        sx={{
          minHeight: 720,
          bgcolor: "#1a1a1a",
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          overflow: "hidden"
        }}
      />
    </Box>
  );
}
