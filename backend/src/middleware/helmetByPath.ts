import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

/** Power BI embed page: allow SDK from unpkg and framing app.powerbi.com. */
const powerBiPageHelmet = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      scriptSrcElem: ["'self'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.powerbi.com",
        "https://login.microsoftonline.com",
        "https://*.analysis.windows.net"
      ],
      frameSrc: ["'self'", "https://*.powerbi.com", "https://app.powerbi.com"],
      objectSrc: ["'none'"]
    }
  }
});

/**
 * Operations home + admin HTML: inline scripts and onclick handlers (Helmet defaults block both:
 * script-src is 'self' only; script-src-attr is 'none').
 */
const operationsAppHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  }
});

/** Relaxed CSP for static mockup (Google Fonts + permissive connect/frame for geocode & embeds). */
const mockupHelmet = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcElem: ["'self'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["'self'", "https:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"]
    }
  }
});

const standardHelmet = helmet();

export function helmetByPath(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/mockup")) {
    mockupHelmet(req, res, next);
  } else if (req.path === "/powerbi-pm.html" || req.path === "/assets/powerbi-pm.js") {
    powerBiPageHelmet(req, res, next);
  } else if (req.path === "/" || req.path === "/index.html" || req.path.startsWith("/admin/")) {
    operationsAppHelmet(req, res, next);
  } else {
    standardHelmet(req, res, next);
  }
}
