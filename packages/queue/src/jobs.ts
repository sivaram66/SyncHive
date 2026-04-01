export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  versionId: string;
  triggerData: Record<string, unknown>;
}

export interface StepJobData {
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  input: Record<string, unknown>;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  timeoutMs: number;
  attempt: number;
}

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  executionId: string;
  nodeId?: string;
  error: string;
  failedAt: string;
  attempts: number;
}

// Job names for type-safe event handling
export const JOB_NAMES = {
  EXECUTE_WORKFLOW: "execute-workflow",
  EXECUTE_STEP: "execute-step",
  DEAD_LETTER: "dead-letter",
} as const;