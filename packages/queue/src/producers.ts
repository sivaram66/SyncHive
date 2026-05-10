import { createExecutionQueue, createStepQueue } from './queues';
import { Queue } from 'bullmq';
import { injectContext } from '@synchive/telemetry';
import type { TraceCarrier } from '@synchive/telemetry';
import type { ExecutionJobData, StepJobData, DeadLetterJobData } from './jobs';

// Re-export TraceCarrier so queue/index.ts can re-export it
export type { TraceCarrier };

// Lazy — only created when first needed, by which time .env is loaded
let executionQueue: Queue | null = null;
let stepQueue: Queue | null = null;

function getExecutionQueue(): Queue {
  if (!executionQueue) executionQueue = createExecutionQueue();
  return executionQueue;
}

function getStepQueue(): Queue {
  if (!stepQueue) stepQueue = createStepQueue();
  return stepQueue;
}

export async function enqueueExecution(data: Omit<ExecutionJobData, 'traceContext'>): Promise<void> {
  const jobData: ExecutionJobData = {
    ...data,
    traceContext: injectContext(),
  };
  await getExecutionQueue().add('execute-workflow', jobData, {
    jobId: `exec-${data.executionId}`,
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });
}

export async function enqueueStep(data: Omit<StepJobData, 'traceContext'>): Promise<void> {
  const jobData: StepJobData = {
    ...data,
    traceContext: injectContext(),
  };
  await getStepQueue().add('execute-step', jobData, {
    jobId: `step-${data.executionId}-${data.nodeId}-${data.attempt}`,
    attempts: 1,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  });
}