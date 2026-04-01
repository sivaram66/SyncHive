import {
  createExecutionQueue,
  createStepQueue,
  createDeadLetterQueue,
} from "@synchive/queue";

export const executionQueue = createExecutionQueue();
export const stepQueue = createStepQueue();
export const deadLetterQueue = createDeadLetterQueue();