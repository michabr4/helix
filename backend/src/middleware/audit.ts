import type { NextFunction, Request, Response } from "express";
import { pool } from "../db.js";
import type { AuthedRequest } from "./auth.js";

export function audit(eventType: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authedReq = req as AuthedRequest;
    const userId = authedReq.auth?.userId ?? null;
    const ipAddress = req.ip;
    const userAgent = req.header("user-agent") ?? "";

    // Fire-and-forget is acceptable for MVP logging path.
    pool.query(
      `INSERT INTO audit.activity_log (event_type, user_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, userId, ipAddress, userAgent, JSON.stringify({ method: req.method, path: req.path })]
    ).catch(() => undefined);

    next();
  };
}
