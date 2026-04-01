import { Queue, QueueOptions } from "bullmq";
import { getRedisConnection } from "./connection";

const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 1, // individual job retry handled by our engine, not BullMQ
    removeOnComplete: {
      age: 86400, // keep completed jobs for 24 hours
      count: 1000, // keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // keep failed jobs for 7 days
      count: 5000, // keep last 5000 failed jobs
    },
  },
};

// Main execution queue — when a workflow is triggered, a job lands here
export function createExecutionQueue(): Queue {
  return new Queue("workflow-execution", {
    ...defaultQueueOptions,
    connection: getRedisConnection(),
  });
}

// Step execution queue — individual node executions within a workflow
export function createStepQueue(): Queue {
  return new Queue("step-execution", {
    ...defaultQueueOptions,
    connection: getRedisConnection(),
  });
}

// Dead letter queue — jobs that failed all retries end up here
export function createDeadLetterQueue(): Queue {
  return new Queue("dead-letter", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: false, // never auto-delete dead letters
      removeOnFail: false,
    },
  });
}