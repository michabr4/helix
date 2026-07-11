import type { Request, Response, NextFunction } from "express";
import { redis } from "../redis.js";

interface RateLimiterOptions {
  /** Maximum number of requests allowed per window. */
  max: number;
  /** Window duration in seconds. */
  windowSec: number;
  /** Redis key prefix — should be unique per endpoint group. */
  keyPrefix: string;
}

/**
 * Simple Redis sliding-window rate limiter.
 * Fails open (allows the request) if Redis is unavailable so auth endpoints
 * stay up even during a cache outage.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? "unknown";
    const key = `${options.keyPrefix}:${ip}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        // Set expiry only on first hit so the window resets naturally
        await redis.expire(key, options.windowSec);
      }
      if (count > options.max) {
        res.status(429).json({ message: "Too many requests, please try again later." });
        return;
      }
    } catch {
      // Redis unavailable — fail open to preserve availability
    }

    next();
  };
}

/** 20 attempts per 15 minutes per IP — applied to /auth/login and /auth/refresh. */
export const authRateLimiter = createRateLimiter({
  max: 20,
  windowSec: 15 * 60,
  keyPrefix: "ratelimit:auth"
});
