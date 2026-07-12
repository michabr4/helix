/**
 * BullMQ queue setup for Helix agent jobs.
 *
 * Each agent type gets its own named queue so jobs can be prioritised
 * and workers can be scaled independently.  All queues share a single
 * Redis connection that is re-used from the app-wide ioredis client.
 */
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config.js";

// Separate Redis connection for BullMQ (it needs a dedicated connection
// that it can block on — ioredis singleton is used elsewhere for pub/sub).
const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
});

export type AgentJobData = {
  agentId: string;
  agentName: string;
  role: string;
  input: Record<string, unknown>;
};

export type AgentJobResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
};

/** Create a typed BullMQ queue for agent jobs */
export function createAgentQueue(queueName: string): Queue<AgentJobData, AgentJobResult> {
  return new Queue<AgentJobData, AgentJobResult>(queueName, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

/** Create a typed BullMQ worker for a queue */
export function createAgentWorker(
  queueName: string,
  processor: (job: Job<AgentJobData, AgentJobResult>) => Promise<AgentJobResult>
): Worker<AgentJobData, AgentJobResult> {
  return new Worker<AgentJobData, AgentJobResult>(queueName, processor, {
    connection: redisConnection,
    concurrency: 2,
  });
}

// Named queues — one per agent tier
export const slaMonitorQueue    = createAgentQueue("helix:sla-monitor");
export const incidentQueue      = createAgentQueue("helix:incident-response");
export const statusReportQueue  = createAgentQueue("helix:status-report");
export const pidQueue           = createAgentQueue("helix:post-incident");

export { redisConnection };
