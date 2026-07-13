import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config.js";
import { helmetByPath } from "./middleware/helmetByPath.js";
import { requestId } from "./middleware/requestId.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { propertiesRouter } from "./routes/properties.js";
import { devicesRouter } from "./routes/devices.js";
import { incidentsRouter } from "./routes/incidents.js";
import { tacRouter } from "./routes/tac.js";
import { integrationsRouter } from "./routes/integrations.js";
import { sourceAdminRouter } from "./routes/sourceAdmin.js";
import { userPropertiesRouter } from "./routes/userProperties.js";
import { powerBiRouter } from "./routes/powerBi.js";
import { salesforceRouter } from "./routes/salesforce.js";
import { securityRouter } from "./routes/security.js";
import { cxRouter } from "./routes/cx.js";
import { vocRouter } from "./routes/voc.js";
import { raidRouter } from "./routes/raid.js";
import { pidRouter } from "./routes/pid.js";
import { journeyRouter } from "./routes/journey.js";
import { slaRouter } from "./routes/sla.js";
import { agentsRouter } from "./routes/agents.js";
import { adoptionRouter } from "./routes/adoption.js";

export function createApp() {
  const app = express();
  app.use(requestId);
  app.use(helmetByPath);
  app.use(
    cors({
      // In development, allow any localhost/127.0.0.1 origin to avoid port-mismatch issues.
      // In production, restrict to explicit CORS_ORIGIN list.
      origin: env.NODE_ENV === "development"
        ? (origin, cb) => cb(null, !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        : env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
      credentials: true
    })
  );
  app.use(cookieParser(env.JWT_SECRET));
  app.use(express.json({ limit: "1mb" }));
  app.use("/", express.static("public"));

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/properties", propertiesRouter);
  app.use("/api/v1/devices", devicesRouter);
  app.use("/api/v1/incidents", incidentsRouter);
  app.use("/api/v1/tac-cases", tacRouter);
  app.use("/api/v1/integrations", integrationsRouter);
  app.use("/api/v1/admin", sourceAdminRouter);
  app.use("/api/v1/admin/users", userPropertiesRouter);
  app.use("/api/v1/analytics/powerbi", powerBiRouter);
  app.use("/api/v1/salesforce", salesforceRouter);
  // These routers are mounted at both the versioned (/api/v1/...) and
  // unversioned (/api/...) paths. The frontend's default VITE_API_BASE_URL
  // is "/api/v1" (see frontend/.env.development and frontend/src/api.ts),
  // so the /api/v1 mount is what the React app actually calls; the
  // unversioned mount is kept for backward compatibility with anything
  // else (e.g. the static /mockup app) that may call the unversioned path.
  app.use("/api/v1/security", securityRouter);
  app.use("/api/security", securityRouter);
  app.use("/api/v1/cx", cxRouter);
  app.use("/api/cx", cxRouter);
  app.use("/api/v1/voc", vocRouter);
  app.use("/api/voc", vocRouter);
  app.use("/api/v1/raid", raidRouter);
  app.use("/api/raid", raidRouter);
  app.use("/api/v1/pid", pidRouter);
  app.use("/api/pid", pidRouter);
  app.use("/api/v1/journey", journeyRouter);
  app.use("/api/journey", journeyRouter);
  app.use("/api/v1/sla", slaRouter);
  app.use("/api/sla", slaRouter);
  app.use("/api/v1/agents", agentsRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/v1/adoption", adoptionRouter);
  app.use("/api/adoption", adoptionRouter);

  // Global error handler — catches any unhandled error thrown or passed to next() in route handlers.
  // Must be defined last and with exactly four parameters for Express to recognise it as an error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const rid = (req as Request & { id?: string }).id;
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    console.error(JSON.stringify({
      level: "error",
      message: "unhandled_error",
      error: message,
      path: req.path,
      method: req.method,
      requestId: rid
    }));
    if (!res.headersSent) {
      // Never leak internal error messages in 5xx responses
      res.status(status).json({ message: status < 500 ? message : "Internal server error" });
    }
  });

  return app;
}
