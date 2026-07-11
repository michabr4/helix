import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { isPowerBiEmbedConfigured, createReportEmbedContext } from "../services/powerBiEmbed.js";

/** Roles that may open the embedded Global PM dashboard (program / delivery leadership). */
const PM_DASHBOARD_ROLES = ["admin", "manager", "sdm", "tam", "csm", "engineer", "viewer"] as const;

export const powerBiRouter = Router();

powerBiRouter.get("/embed", requireAuth, requireRoles([...PM_DASHBOARD_ROLES]), async (_req, res) => {
  if (!isPowerBiEmbedConfigured()) {
    res.json({
      enabled: false,
      message: "Power BI embed is not configured. Set POWERBI_ENABLED and service principal + workspace/report IDs (see docs/POWERBI_GLOBAL_PM.md)."
    });
    return;
  }

  try {
    const ctx = await createReportEmbedContext();
    res.json(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Power BI embed error";
    res.status(502).json({ enabled: false, message: msg });
  }
});
