// TraceCarrier is a plain string map — no circular dependency on @synchive/telemetry
export type TraceCarrier = Record<string, string>;

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  versionId: string;
  triggeredBy?: 'manual' | 'webhook' | 'schedule';
  triggerData?: Record<string, unknown>;
  traceContext?: TraceCarrier;
}

export interface StepJobData {
  executionId: string;
  nodeId: string;
  attempt: number;
  traceContext?: TraceCarrier;
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
  EXECUTE_WORKFLOW: 'execute-workflow',
  EXECUTE_STEP: 'execute-step',
  DEAD_LETTER: 'dead-letter',
} as const;