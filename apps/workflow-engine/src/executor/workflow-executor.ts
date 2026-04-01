import { eq } from "drizzle-orm";
import {
  workflowExecutions,
  stepExecutions,
  workflowVersions,
} from "@synchive/db";
import {
  WorkflowSnapshot,
  ExecutionStatus,
  StepStatus,
} from "@synchive/shared-types";
import { ExecutionJobData } from "@synchive/queue";
import {
  createLogger,
  createExecutionLogger,
} from "@synchive/logger";
import { createDb } from "@synchive/db";
import { config } from "../config";
import { buildDAG, getNextNodes, DAGGraph } from "./dag";
import { evaluateCondition } from "./condition-evaluator";
import { executeNode, NodeExecutionResult } from "./node-executor";

const logger = createLogger({ service: "workflow-engine" });
const db = createDb(config.databaseUrl);

export async function executeWorkflow(
  jobData: ExecutionJobData
): Promise<void> {
  const execLogger = createExecutionLogger(logger, {
    executionId: jobData.executionId,
    workflowId: jobData.workflowId,
  });

  const startTime = Date.now();

  try {
    // Update execution status to running
    await db
      .update(workflowExecutions)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workflowExecutions.id, jobData.executionId));

    execLogger.executionStarted(jobData.triggerData);

    // Load the version snapshot
    const [version] = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.id, jobData.versionId))
      .limit(1);

    if (!version) {
      throw new Error(`Version ${jobData.versionId} not found`);
    }

    const snapshot = version.snapshot as unknown as WorkflowSnapshot;

    // Build the DAG
    const dag = buildDAG(snapshot);

    if (dag.entryNodes.length === 0) {
      throw new Error("Workflow has no entry nodes");
    }

    // Execute the DAG
    const completedNodes = new Set<string>();
    const nodeOutputs = new Map<string, Record<string, unknown>>();
    const failedNodes = new Set<string>();

    // Start with entry nodes
    let currentNodes = [...dag.entryNodes];

    while (currentNodes.length > 0) {
      // Execute all current nodes (these can run in parallel)
      const results = await Promise.allSettled(
        currentNodes.map((nodeId) =>
          executeNodeWithTracking(
            jobData.executionId,
            dag,
            nodeId,
            nodeOutputs,
            jobData.triggerData
          )
        )
      );

      // Process results
      const nextNodes: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const nodeId = currentNodes[i];
        const result = results[i];

        if (result.status === "fulfilled" && result.value.success) {
          completedNodes.add(nodeId);
          nodeOutputs.set(nodeId, result.value.output);

          // Find next executable nodes
          const candidates = getNextNodes(dag, nodeId, completedNodes);

          for (const candidateId of candidates) {
            // Check edge conditions
            const dagNode = dag.nodes.get(candidateId)!;
            const allEdgesPassed = dagNode.incomingEdges.every((edge) => {
              if (edge.sourceNodeId !== nodeId) return true; // only check edges from the just-completed node
              const sourceOutput = nodeOutputs.get(edge.sourceNodeId) || {};
              return evaluateCondition(edge.conditionExpression, sourceOutput);
            });

            if (allEdgesPassed && !nextNodes.includes(candidateId)) {
              nextNodes.push(candidateId);
            }
          }
        } else {
          failedNodes.add(nodeId);
          const error =
            result.status === "rejected"
              ? result.reason?.message
              : result.value.error;

          logger.error(
            {
              nodeId,
              error,
              executionId: jobData.executionId,
            },
            "Node execution failed permanently"
          );
        }
      }

      currentNodes = nextNodes;
    }

    // Determine final execution status
    const durationMs = Date.now() - startTime;

    if (failedNodes.size > 0) {
      const errorMsg = `${failedNodes.size} node(s) failed: ${Array.from(failedNodes).join(", ")}`;

      await db
        .update(workflowExecutions)
        .set({
          status: "failed",
          error: errorMsg,
          completedAt: new Date(),
          result: {
            completedNodes: Array.from(completedNodes),
            failedNodes: Array.from(failedNodes),
            durationMs,
          },
        })
        .where(eq(workflowExecutions.id, jobData.executionId));

      execLogger.executionFailed(errorMsg, durationMs);
    } else {
      // Collect final output from terminal nodes (nodes with no outgoing edges)
      const terminalOutputs: Record<string, unknown> = {};
      for (const [nodeId, dagNode] of dag.nodes) {
        if (dagNode.outgoingEdges.length === 0 && nodeOutputs.has(nodeId)) {
          terminalOutputs[dagNode.node.name] = nodeOutputs.get(nodeId);
        }
      }

      await db
        .update(workflowExecutions)
        .set({
          status: "completed",
          completedAt: new Date(),
          result: {
            completedNodes: Array.from(completedNodes),
            outputs: terminalOutputs,
            durationMs,
          },
        })
        .where(eq(workflowExecutions.id, jobData.executionId));

      execLogger.executionCompleted(durationMs);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    await db
      .update(workflowExecutions)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, jobData.executionId));

    execLogger.executionFailed(errorMsg, durationMs);
    throw error; // re-throw for BullMQ to handle
  }
}

/**
 * Execute a single node with full tracking:
 * - Create step_execution record
 * - Resolve input from parent outputs
 * - Handle retries with backoff
 * - Update step status
 */
async function executeNodeWithTracking(
  executionId: string,
  dag: DAGGraph,
  nodeId: string,
  nodeOutputs: Map<string, Record<string, unknown>>,
  triggerData: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const dagNode = dag.nodes.get(nodeId)!;
  const node = dagNode.node;

  const stepLogger = createExecutionLogger(logger, {
    executionId,
    workflowId: "",
    nodeId: node.id,
    nodeName: node.name,
  });

  // Resolve input: merge outputs from all parent nodes
  let input: Record<string, unknown>;

  if (dagNode.incomingEdges.length === 0) {
    // Entry node — use trigger data
    input = triggerData;
  } else {
    // Merge all parent outputs
    input = {};
    for (const edge of dagNode.incomingEdges) {
      const parentOutput = nodeOutputs.get(edge.sourceNodeId);
      if (parentOutput) {
        Object.assign(input, parentOutput);
      }
    }
  }

  // Retry loop
  const maxAttempts = node.retryPolicy.maxRetries + 1; // +1 for the initial attempt
  let lastError: string = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Create step execution record
    const [stepExec] = await db
      .insert(stepExecutions)
      .values({
        executionId,
        nodeId: node.id,
        status: "running",
        input,
        attempt,
        startedAt: new Date(),
      })
      .returning();

    stepLogger.stepStarted(node.type, input);

    try {
      // Execute with timeout
      const result = await executeWithTimeout(
        () => executeNode(node, input),
        node.timeoutMs
      );

      if (result.success) {
        // Update step as completed
        await db
          .update(stepExecutions)
          .set({
            status: "completed",
            output: result.output,
            completedAt: new Date(),
          })
          .where(eq(stepExecutions.id, stepExec.id));

        stepLogger.stepCompleted(result.output, Date.now() - stepExec.startedAt!.getTime());

        return result;
      } else {
        // Node returned failure
        lastError = result.error || "Unknown error";

        await db
          .update(stepExecutions)
          .set({
            status: "failed",
            error: lastError,
            completedAt: new Date(),
          })
          .where(eq(stepExecutions.id, stepExec.id));

        const willRetry = attempt < maxAttempts;
        stepLogger.stepFailed(lastError, willRetry);

        if (willRetry) {
          const delayMs =
            node.retryPolicy.backoffMs *
            Math.pow(node.retryPolicy.backoffMultiplier, attempt - 1);
          stepLogger.stepRetrying(attempt + 1, delayMs);
          await sleep(delayMs);
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      const isTimeout = lastError.includes("timed out");
      const status: StepStatus = isTimeout ? "timed_out" : "failed";

      await db
        .update(stepExecutions)
        .set({
          status,
          error: lastError,
          completedAt: new Date(),
        })
        .where(eq(stepExecutions.id, stepExec.id));

      if (isTimeout) {
        stepLogger.stepTimedOut(node.timeoutMs);
      }

      const willRetry = attempt < maxAttempts;
      stepLogger.stepFailed(lastError, willRetry);

      if (willRetry) {
        const delayMs =
          node.retryPolicy.backoffMs *
          Math.pow(node.retryPolicy.backoffMultiplier, attempt - 1);
        stepLogger.stepRetrying(attempt + 1, delayMs);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    output: {},
    error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`,
  };
}

/**
 * Execute a function with a timeout.
 * Throws if the function doesn't complete within timeoutMs.
 */
function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}