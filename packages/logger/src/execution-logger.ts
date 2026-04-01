import { Logger } from "pino";

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId?: string;
  nodeName?: string;
  attempt?: number;
}

export function createExecutionLogger(
  baseLogger: Logger,
  context: ExecutionContext
) {
  // Child logger inherits all base fields and adds execution context
  const logger = baseLogger.child({
    executionId: context.executionId,
    workflowId: context.workflowId,
    ...(context.nodeId && { nodeId: context.nodeId }),
    ...(context.nodeName && { nodeName: context.nodeName }),
    ...(context.attempt && { attempt: context.attempt }),
  });

  return {
    executionStarted: (triggerData: Record<string, unknown>) => {
      logger.info({ triggerData }, "Workflow execution started");
    },

    executionCompleted: (durationMs: number) => {
      logger.info({ durationMs }, "Workflow execution completed");
    },

    executionFailed: (error: string, durationMs: number) => {
      logger.error({ error, durationMs }, "Workflow execution failed");
    },

    stepStarted: (nodeType: string, input: Record<string, unknown>) => {
      logger.info({ nodeType, input }, "Step execution started");
    },

    stepCompleted: (
      output: Record<string, unknown>,
      durationMs: number
    ) => {
      logger.info({ output, durationMs }, "Step execution completed");
    },

    stepFailed: (error: string, willRetry: boolean, nextAttemptIn?: number) => {
      logger.warn(
        { error, willRetry, nextAttemptMs: nextAttemptIn },
        "Step execution failed"
      );
    },

    stepRetrying: (attempt: number, delayMs: number) => {
      logger.info(
        { attempt, delayMs },
        "Step retrying after backoff"
      );
    },

    stepTimedOut: (timeoutMs: number) => {
      logger.error({ timeoutMs }, "Step execution timed out");
    },

    deadLettered: (reason: string) => {
      logger.error({ reason }, "Job moved to dead letter queue");
    },

    edgeEvaluated: (
      sourceNodeId: string,
      targetNodeId: string,
      condition: string | null,
      result: boolean
    ) => {
      logger.debug(
        { sourceNodeId, targetNodeId, condition, passed: result },
        "Edge condition evaluated"
      );
    },
  };
}
