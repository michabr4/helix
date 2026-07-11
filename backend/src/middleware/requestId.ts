import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Assigns a correlation ID to every request.
 * Reads X-Request-ID from the incoming header if present (useful for gateway forwarding),
 * otherwise generates a new UUID. Sets X-Request-ID on the response and attaches the
 * id to req so route handlers and the error handler can include it in log lines.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string | undefined)?.trim() || randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader("X-Request-ID", id);
  next();
}
