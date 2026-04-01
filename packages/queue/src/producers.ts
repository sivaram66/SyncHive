import { Queue } from "bullmq";
import {
  ExecutionJobData,
  StepJobData,
  DeadLetterJobData,
  JOB_NAMES,
} from "./jobs";

export async function enqueueExecution(
  queue: Queue,
  data: ExecutionJobData
): Promise<string> {
  const job = await queue.add(JOB_NAMES.EXECUTE_WORKFLOW, data, {
    jobId: `exec-${data.executionId}`, // deterministic ID prevents duplicates
    priority: 1,
  });

  return job.id!;
}

export async function enqueueStep(
  queue: Queue,
  data: StepJobData,
  delayMs?: number
): Promise<string> {
  const job = await queue.add(JOB_NAMES.EXECUTE_STEP, data, {
    jobId: `step-${data.executionId}-${data.nodeId}-${data.attempt}`,
    delay: delayMs, // used for retry backoff
    priority: 1,
  });

  return job.id!;
}

export async function enqueueDeadLetter(
  queue: Queue,
  data: DeadLetterJobData
): Promise<string> {
  const job = await queue.add(JOB_NAMES.DEAD_LETTER, data, {
    jobId: `dlq-${data.originalJobId}-${Date.now()}`,
  });

  return job.id!;
}