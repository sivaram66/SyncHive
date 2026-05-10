import { getRedisConnection } from "./connection";
import IORedis from "ioredis";

const CHANNEL_PREFIX = "synchive:execution";

export interface ExecutionEvent {
  type:
    | "execution:started"
    | "execution:completed"
    | "execution:failed"
    | "step:started"
    | "step:completed"
    | "step:failed"
    | "step:retrying"
    | "step:timed_out";
  executionId: string;
  workflowId: string;
  data: {
    nodeId?: string;
    nodeName?: string;
    nodeType?: string;
    status?: string;
    output?: Record<string, unknown>;
    error?: string;
    attempt?: number;
    durationMs?: number;
    willRetry?: boolean;
    nextAttemptMs?: number;
  };
  timestamp: string;
}

/**
 * Publish an execution event to Redis pub/sub.
 * The channel is scoped per execution so subscribers only
 * receive events for the execution they care about.
 */
export async function publishExecutionEvent(
  event: ExecutionEvent
): Promise<void> {
  const connection = getRedisConnection();
  const channel = `${CHANNEL_PREFIX}:${event.executionId}`;
  await connection.publish(channel, JSON.stringify(event));
}

/**
 * Create a NEW Redis connection for subscribing.
 * IMPORTANT: Redis requires a dedicated connection for subscriptions.
 * A connection in subscribe mode cannot run other commands.
 * This is NOT the shared connection — it's a fresh one.
 */
export function createSubscriber(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Subscribe to execution events for a specific execution.
 * Returns the subscriber connection (caller must disconnect when done).
 */
export async function subscribeToExecution(
  executionId: string,
  onEvent: (event: ExecutionEvent) => void
): Promise<IORedis> {
  const subscriber = createSubscriber();
  const channel = `${CHANNEL_PREFIX}:${executionId}`;

  subscriber.on("message", (_ch: string, message: string) => {
    try {
      const event = JSON.parse(message) as ExecutionEvent;
      onEvent(event);
    } catch {
      // ignore malformed messages
    }
  });

  await subscriber.subscribe(channel);
  return subscriber;
}

export function getChannelName(executionId: string): string {
  return `${CHANNEL_PREFIX}:${executionId}`;
}