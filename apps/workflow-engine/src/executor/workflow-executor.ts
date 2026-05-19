import { eq } from 'drizzle-orm';
import { createDb  } from '@synchive/db';
import { workflowVersions, workflowExecutions, stepExecutions } from '@synchive/db';
import { WorkflowSnapshot, SnapshotNode } from '@synchive/shared-types';
import { buildDAG, topologicalSort } from './dag';
import { executeNode } from './node-executor';
import { publishExecutionEvent } from '@synchive/queue';
import { createLogger } from '@synchive/logger';
const logger = createLogger({ service: 'workflow-engine' });
import {
  getTracer,
  SpanAttributes,
  SpanStatusCode,
  SpanKind,
} from '@synchive/telemetry';

const tracer = getTracer('workflow-engine');

export interface ExecuteWorkflowInput {
  executionId: string;
  workflowId: string;
  versionId: string;
  triggeredBy: 'manual' | 'webhook' | 'schedule';
  triggerData?: Record<string, unknown>;
}

/**
 * Top-level workflow orchestrator.
 *
 * Span hierarchy produced by this function:
 *
 *   workflow-engine.process-job          (worker/index.ts)
 *     └── workflow-engine.execute        (this function)
 *           ├── workflow-engine.execute-node  (node 1)
 *           ├── workflow-engine.execute-node  (node 2 — parallel)
 *           └── workflow-engine.execute-node  (node 3)
 *
 * Each node span carries nodeId, nodeType, nodeName, attempt number.
 * Failed nodes record the exception and set SpanStatusCode.ERROR.
 * Retried nodes produce one span per attempt.
 */
export async function executeWorkflow(input: ExecuteWorkflowInput): Promise<void> {
  const { executionId, workflowId, versionId, triggeredBy, triggerData } = input;
  const db = createDb(process.env.DATABASE_URL!);

  return tracer.startActiveSpan(
    'workflow-engine.execute',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [SpanAttributes.EXECUTION_ID]: executionId,
        [SpanAttributes.WORKFLOW_ID]: workflowId,
        [SpanAttributes.VERSION_ID]: versionId,
        [SpanAttributes.EXECUTION_TRIGGER]: triggeredBy,
      },
    },
    async (workflowSpan) => {
      try {
        // Mark execution as running
        await db
          .update(workflowExecutions)
          .set({ status: 'running', startedAt: new Date() })
          .where(eq(workflowExecutions.id, executionId));

        await publishExecutionEvent({
          type: 'execution:started',
          executionId,
          workflowId,
          data: { status: 'running' },
          timestamp: new Date().toISOString(),
        });

        // Load the frozen version snapshot
        const [version] = await db
          .select()
          .from(workflowVersions)
          .where(eq(workflowVersions.id, versionId));

        if (!version) throw new Error(`Version ${versionId} not found`);

        const snapshot = version.snapshot as WorkflowSnapshot;
        workflowSpan.setAttribute(SpanAttributes.WORKFLOW_NAME, workflowId);

        // Build the DAG and find execution levels
        const dag = buildDAG(snapshot);
        const levels = topologicalSort(dag);

        // Node output accumulator — later nodes can reference earlier outputs
        const nodeOutputs: Record<string, unknown> = {};
        if (triggerData) nodeOutputs['__trigger__'] = triggerData;

        let executionFailed = false;

        // Execute level by level. Within each level, nodes run in parallel.
        for (const level of levels) {
          if (executionFailed) break;

          const levelResults = await Promise.allSettled(
            level.map((nodeId) => {
              const node = snapshot.nodes.find((n) => n.id === nodeId);
              if (!node) return Promise.resolve();
              return executeNodeWithSpan({ node, executionId, workflowId, nodeOutputs, snapshot, db });
            })
          );

          for (const result of levelResults) {
            if (result.status === 'rejected') {
              executionFailed = true;
              logger.error({ err: result.reason }, 'node execution failed');
            }
          }

          // Collect outputs from completed nodes
          for (const nodeId of level) {
            if (nodeOutputs[nodeId] !== undefined) continue; // already set
            // outputs are set inside executeNodeWithSpan via nodeOutputs ref
          }
        }

        if (executionFailed) {
          await db
            .update(workflowExecutions)
            .set({ status: 'failed', completedAt: new Date() })
            .where(eq(workflowExecutions.id, executionId));
          workflowSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'One or more nodes failed' });
          await publishExecutionEvent({
            type: 'execution:failed',
            executionId,
            workflowId,
            data: { status: 'failed' },
            timestamp: new Date().toISOString(),
          });
        } else {
          await db
            .update(workflowExecutions)
            .set({ status: 'completed', completedAt: new Date() })
            .where(eq(workflowExecutions.id, executionId));
          workflowSpan.setStatus({ code: SpanStatusCode.OK });
          await publishExecutionEvent({
            type: 'execution:completed',
            executionId,
            workflowId,
            data: { status: 'completed' },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        workflowSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        workflowSpan.recordException(error);

        await db
          .update(workflowExecutions)
          .set({ status: 'failed', completedAt: new Date() })
          .where(eq(workflowExecutions.id, executionId));

        // Best-effort publish — don't let telemetry failure mask the real error
        publishExecutionEvent({
          type: 'execution:failed',
          executionId,
          workflowId,
          data: { status: 'failed', error: error.message },
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        throw err;
      } finally {
        workflowSpan.end();
      }
    }
  );
}

interface ExecuteNodeWithSpanInput {
  node: SnapshotNode;
  executionId: string;
  workflowId: string;
  nodeOutputs: Record<string, unknown>;
  snapshot: WorkflowSnapshot;
  db: ReturnType<typeof createDb>;
}

/**
 * Executes a single node and wraps it in an OTel span.
 *
 * Each attempt (for retried nodes) produces its own span. This is intentional:
 * you can see in Jaeger exactly how many attempts a node took and how long
 * each backoff wait was.
 */
async function executeNodeWithSpan(input: ExecuteNodeWithSpanInput): Promise<void> {
  const { node, executionId, workflowId, nodeOutputs, snapshot, db } = input;

  const retryPolicy = node.retryPolicy ?? { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 };
  const maxAttempts = retryPolicy.maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spanName = `workflow-engine.execute-node`;

    await tracer.startActiveSpan(
      spanName,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [SpanAttributes.NODE_ID]: node.id,
          [SpanAttributes.NODE_TYPE]: node.type,
          [SpanAttributes.NODE_NAME]: node.name ?? '',
          [SpanAttributes.EXECUTION_ID]: executionId,
          [SpanAttributes.STEP_ATTEMPT]: attempt,
        },
      },
      async (nodeSpan) => {
        // Create step_executions row for this attempt
        const [stepRow] = await db
          .insert(stepExecutions)
          .values({
            executionId,
            nodeId: node.id,
            attempt,
            status: 'running',
            startedAt: new Date(),
          })
          .returning();

        await publishExecutionEvent({
          type: 'step:started',
          executionId,
          workflowId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            status: 'running',
            attempt,
          },
          timestamp: new Date().toISOString(),
        });

        try {
          const result = await executeNode(node, nodeOutputs);

          // If the integration returns success:false, treat it as a thrown error
          // so retry logic and failure tracking work correctly
          if (!result.success) {
            throw new Error(result.error ?? `Node ${node.name} returned success: false`);
          }

          // Store output so downstream nodes can reference it
          nodeOutputs[node.id] = result.output;

          const seen = new WeakSet()
          const safeOutput = JSON.parse(JSON.stringify(result.output, (_, v) => {
            if (typeof v === 'object' && v !== null) {
              if (seen.has(v)) return '[Circular]'
              seen.add(v)
            }
            return v
          }))

          await db
            .update(stepExecutions)
            .set({ status: 'completed', output: safeOutput as any, completedAt: new Date() })
            .where(eq(stepExecutions.id, stepRow.id));

          await publishExecutionEvent({
            type: 'step:completed',
            executionId,
            workflowId,
            data: {
              nodeId: node.id,
              nodeName: node.name,
              nodeType: node.type,
              status: 'completed',
              output: safeOutput as Record<string, unknown>,
              attempt,
            },
            timestamp: new Date().toISOString(),
          });

          nodeSpan.setAttribute(SpanAttributes.STEP_STATUS, 'completed');
          nodeSpan.setStatus({ code: SpanStatusCode.OK });
          nodeSpan.end();
          return; // success — exit retry loop

        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          nodeSpan.recordException(error);

          const isLastAttempt = attempt === maxAttempts;

          if (isLastAttempt) {
            await db
              .update(stepExecutions)
              .set({ status: 'failed', error: error.message, completedAt: new Date() })
              .where(eq(stepExecutions.id, stepRow.id));

            await publishExecutionEvent({
              type: 'step:failed',
              executionId,
              workflowId,
              data: {
                nodeId: node.id,
                nodeName: node.name,
                nodeType: node.type,
                status: 'failed',
                error: error.message,
                attempt,
                willRetry: false,
              },
              timestamp: new Date().toISOString(),
            });

            nodeSpan.setAttribute(SpanAttributes.STEP_STATUS, 'failed');
            nodeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            nodeSpan.end();
            throw err; // propagate — marks execution as failed
          } else {
            await db
              .update(stepExecutions)
              .set({ status: 'retrying', error: error.message })
              .where(eq(stepExecutions.id, stepRow.id));

            const backoffMs = retryPolicy.backoffMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);

            await publishExecutionEvent({
              type: 'step:retrying',
              executionId,
              workflowId,
              data: {
                nodeId: node.id,
                nodeName: node.name,
                nodeType: node.type,
                status: 'retrying',
                error: error.message,
                attempt,
                willRetry: true,
                nextAttemptMs: backoffMs,
              },
              timestamp: new Date().toISOString(),
            });

            nodeSpan.setAttribute(SpanAttributes.STEP_STATUS, 'retrying');
            nodeSpan.setStatus({ code: SpanStatusCode.ERROR, message: `attempt ${attempt} failed, retrying` });
            nodeSpan.end();

            logger.info({ nodeId: node.id, attempt, backoffMs }, 'retrying node after backoff');
            await sleep(backoffMs);
          }
        }
      }
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}