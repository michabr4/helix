import { Redis } from "ioredis";
import { env } from "./config.js";

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true
});
