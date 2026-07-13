import { AppBar, Box, Button, CircularProgress, Container, Toolbar, Typography } from "@mui/material";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { exchangeSsoCode, getAccessToken, logout } from "./api";

// Lazy-loaded pages — each page is a separate Vite chunk, keeping the
// initial bundle under 200 KB gzip. New pages are added here only.
const LoginPage              = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage          = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const IncidentsPage          = lazy(() => import("./pages/IncidentsPage").then(m => ({ default: m.IncidentsPage })));
const DevicesPage            = lazy(() => import("./pages/DevicesPage").then(m => ({ default: m.DevicesPage })));
const PropertiesPage         = lazy(() => import("./pages/PropertiesPage").then(m => ({ default: m.PropertiesPage })));
const PowerBiPmDashboardPage = lazy(() => import("./pages/PowerBiPmDashboardPage").then(m => ({ default: m.PowerBiPmDashboardPage })));
const SalesforcePage         = lazy(() => import("./pages/SalesforcePage").then(m => ({ default: m.SalesforcePage })));
const TacCasesPage           = lazy(() => import("./pages/TacCasesPage").then(m => ({ default: m.TacCasesPage })));
const IntegrationsPage       = lazy(() => import("./pages/IntegrationsPage").then(m => ({ default: m.IntegrationsPage })));
const SecurityPage           = lazy(() => import("./pages/SecurityPage").then(m => ({ default: m.SecurityPage })));
const FieldNoticesPage       = lazy(() => import("./pages/FieldNoticesPage").then(m => ({ default: m.FieldNoticesPage })));
const SentimentPage          = lazy(() => import("./pages/SentimentPage").then(m => ({ default: m.SentimentPage })));
const JourneyPage            = lazy(() => import("./pages/JourneyPage").then(m => ({ default: m.JourneyPage })));
const ExperienceCommandPage  = lazy(() => import("./pages/ExperienceCommandPage").then(m => ({ default: m.ExperienceCommandPage })));
const PersonasConsolePage    = lazy(() => import("./pages/PersonasConsolePage").then(m => ({ default: m.PersonasConsolePage })));
const AdoptionPage           = lazy(() => import("./pages/AdoptionPage").then(m => ({ default: m.AdoptionPage })));

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PageLoader() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <CircularProgress />
    </Box>
  );
}

const NAV_LINKS = [
  { label: "Overview",      path: "/dashboard" },
  { label: "Incidents",     path: "/incidents" },
  { label: "Devices",       path: "/devices" },
  { label: "Properties",    path: "/properties" },
  { label: "Security",      path: "/security" },
  { label: "Field Notices", path: "/field-notices" },
  { label: "Sentiment",     path: "/sentiment" },
  { label: "Adoption",      path: "/adoption" },
  { label: "Journey",       path: "/journey" },
  { label: "CX Command",    path: "/cx-command" },
  { label: "Console",       path: "/console" },
  { label: "TAC Cases",     path: "/tac-cases" },
  { label: "Integrations",  path: "/integrations" },
  { label: "Salesforce",    path: "/salesforce" },
  { label: "Power BI",      path: "/powerbi-pm" },
];

export function App() {
  const navigate = useNavigate();

  // On mount, check for SSO one-time exchange code in the query string.
  // Backend SSO callback redirects here with ?sso_code=<uuid> instead of
  // putting tokens in the URL hash fragment (security improvement H1).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoCode = params.get("sso_code");
    if (!ssoCode) return;

    params.delete("sso_code");
    const cleanUrl =
      window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState(null, "", cleanUrl);

    exchangeSsoCode(ssoCode)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login?error=sso_failed", { replace: true }));
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar sx={{ gap: 0.5, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: "1rem", fontWeight: 700 }}>
            ServiceFlow
          </Typography>
          {NAV_LINKS.map(({ label, path }) => (
            <Button key={path} color="inherit" size="small"
              onClick={() => navigate(path)}
              sx={{ fontSize: "0.75rem", minWidth: "auto", px: 1 }}>
              {label}
            </Button>
          ))}
          <Button color="inherit" size="small" onClick={handleLogout} sx={{ ml: 1 }}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 3 }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/dashboard"     element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/incidents"     element={<RequireAuth><IncidentsPage /></RequireAuth>} />
            <Route path="/devices"       element={<RequireAuth><DevicesPage /></RequireAuth>} />
            <Route path="/properties"    element={<RequireAuth><PropertiesPage /></RequireAuth>} />
            <Route path="/security"      element={<RequireAuth><SecurityPage /></RequireAuth>} />
            <Route path="/field-notices" element={<RequireAuth><FieldNoticesPage /></RequireAuth>} />
            <Route path="/adoption"      element={<RequireAuth><AdoptionPage /></RequireAuth>} />
            <Route path="/sentiment"     element={<RequireAuth><SentimentPage /></RequireAuth>} />
            <Route path="/journey"       element={<RequireAuth><JourneyPage /></RequireAuth>} />
            <Route path="/cx-command"    element={<RequireAuth><ExperienceCommandPage /></RequireAuth>} />
            <Route path="/console"       element={<RequireAuth><PersonasConsolePage /></RequireAuth>} />
            <Route path="/tac-cases"     element={<RequireAuth><TacCasesPage /></RequireAuth>} />
            <Route path="/integrations"  element={<RequireAuth><IntegrationsPage /></RequireAuth>} />
            <Route path="/salesforce"    element={<RequireAuth><SalesforcePage /></RequireAuth>} />
            <Route path="/powerbi-pm"    element={<RequireAuth><PowerBiPmDashboardPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}
