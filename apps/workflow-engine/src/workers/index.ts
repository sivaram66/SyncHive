import { Worker, Job } from 'bullmq';
import { getRedisConnection  } from '@synchive/queue';
import { ExecutionJobData } from '@synchive/queue';
import { executeWorkflow } from '../executor/workflow-executor';
import { createLogger } from '@synchive/logger';
const logger = createLogger({ service: 'workflow-engine' });
import {
  extractContext,
  getTracer,
  SpanAttributes,
  SpanStatusCode,
  SpanKind,
  context,
} from '@synchive/telemetry';

const tracer = getTracer('workflow-engine');

/**
 * Processes a workflow execution job.
 *
 * The trace context flow:
 * 1. API gateway creates a span for the webhook/execute route (auto-instrumented)
 * 2. Gateway injects context into job data (producers.ts)
 * 3. Worker extracts context here — now we're "inside" the gateway's trace
 * 4. We start a new span as a child of the gateway span
 * 5. Everything inside executeWorkflow runs under this span
 *
 * Result: one unbroken trace from HTTP request → queue → execution.
 */
async function processExecutionJob(job: Job<ExecutionJobData>): Promise<void> {
  const { executionId, workflowId, versionId, triggeredBy ='webhook', triggerData, traceContext } = job.data;

  // Reconstruct the trace context from the serialized carrier.
  // If traceContext is missing (e.g. jobs enqueued before OTel was set up),
  // extractContext gracefully falls back to a fresh context.
  const parentCtx = extractContext(traceContext);

  // context.with() runs the callback inside the extracted context.
  // Any spans started inside will be children of the gateway span.
  await context.with(parentCtx, async () => {
    await tracer.startActiveSpan(
      'workflow-engine.process-job',
      {
        kind: SpanKind.CONSUMER, // semantic: this span consumes a message
        attributes: {
          [SpanAttributes.EXECUTION_ID]: executionId,
          [SpanAttributes.WORKFLOW_ID]: workflowId,
          [SpanAttributes.VERSION_ID]: versionId,
          [SpanAttributes.EXECUTION_TRIGGER]: triggeredBy,
          [SpanAttributes.JOB_ID]: job.id ?? '',
          [SpanAttributes.JOB_QUEUE]: 'workflow-execution',
        },
      },
      async (span) => {
        try {
          await executeWorkflow({ executionId, workflowId, versionId, triggeredBy, triggerData });
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.recordException(error);
          throw err; // re-throw so BullMQ marks job as failed
        } finally {
          span.end();
        }
      }
    );
  });
}

let executionWorker: Worker | null = null;

export function createWorkers(): void {
  executionWorker = new Worker<ExecutionJobData>(
    'workflow-execution',
    processExecutionJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  executionWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'job completed');
  });

  executionWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'job failed');
  });

  logger.info('workers started');
}

export async function gracefulShutdown(): Promise<void> {
  if (executionWorker) {
    await executionWorker.close();
    logger.info('worker drained and closed');
  }
}


export const startWorkers = createWorkers;
export const stopWorkers = gracefulShutdown;