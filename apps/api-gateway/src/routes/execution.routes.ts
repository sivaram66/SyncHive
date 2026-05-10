import { Router, Request, Response, NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  workflowExecutions,
  stepExecutions,
  workflows,
} from "@synchive/db";
import { subscribeToExecution, ExecutionEvent } from "@synchive/queue";
import { ApiResponse } from "@synchive/shared-types";
import { authenticate } from "../middleware/auth";
import { db } from "../services/db.service";
import { AppError } from "../middleware/error-handler";
import { createLogger } from "@synchive/logger";

const logger = createLogger({ service: "api-gateway" });

export const executionRouter = Router();

executionRouter.use(authenticate);

// SSE stream for real-time execution updates
executionRouter.get(
  "/:executionId/stream",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executionId = req.params.executionId as string;

      const [execution] = await db
        .select({
          id: workflowExecutions.id,
          workflowId: workflowExecutions.workflowId,
          status: workflowExecutions.status,
        })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!execution) {
        throw new AppError(404, "EXECUTION_NOT_FOUND", "Execution not found");
      }

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, execution.workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(403, "FORBIDDEN", "You don't own this execution");
      }

      // If execution is already terminal, send current state and close
      const terminalStatuses = ["completed", "failed", "cancelled", "timed_out"];
      if (terminalStatuses.includes(execution.status)) {
        // Send existing step data as events
        const steps = await db
          .select()
          .from(stepExecutions)
          .where(eq(stepExecutions.executionId, executionId))
          .orderBy(stepExecutions.startedAt);

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        // Send historical step events
        for (const step of steps) {
          const event: ExecutionEvent = {
            type: step.status === "completed" ? "step:completed" : "step:failed",
            executionId,
            workflowId: execution.workflowId,
            data: {
              nodeId: step.nodeId,
              status: step.status,
              output: step.output as Record<string, unknown> | undefined,
              error: step.error || undefined,
              attempt: step.attempt,
            },
            timestamp: (step.completedAt || step.startedAt || new Date()).toISOString(),
          };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Send terminal execution event
        const terminalEvent: ExecutionEvent = {
          type: execution.status === "completed" ? "execution:completed" : "execution:failed",
          executionId,
          workflowId: execution.workflowId,
          data: { status: execution.status },
          timestamp: new Date().toISOString(),
        };
        res.write(`data: ${JSON.stringify(terminalEvent)}\n\n`);
        res.end();
        return;
      }

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: "connected", executionId })}\n\n`);

      // Subscribe to Redis pub/sub for this execution
      const subscriber = await subscribeToExecution(executionId, (event) => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);

          // Close the stream when execution reaches terminal state
          if (
            event.type === "execution:completed" ||
            event.type === "execution:failed"
          ) {
            setTimeout(() => {
              subscriber.disconnect();
              res.end();
            }, 500); // small delay to ensure the event is flushed
          }
        } catch {
          // Client disconnected
          subscriber.disconnect();
        }
      });

      // Handle client disconnect
      req.on("close", () => {
        logger.debug({ executionId }, "SSE client disconnected");
        subscriber.disconnect();
      });

      // Safety timeout — close after 5 minutes to prevent zombie connections
      const timeout = setTimeout(() => {
        logger.debug({ executionId }, "SSE connection timed out");
        subscriber.disconnect();
        res.end();
      }, 5 * 60 * 1000);

      req.on("close", () => clearTimeout(timeout));
    } catch (error) {
      next(error);
    }
  }
);

// Get detailed step executions for a specific execution
executionRouter.get(
  "/:executionId/steps",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executionId = req.params.executionId as string;

      const [execution] = await db
        .select({
          id: workflowExecutions.id,
          workflowId: workflowExecutions.workflowId,
        })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!execution) {
        throw new AppError(404, "EXECUTION_NOT_FOUND", "Execution not found");
      }

      // Verify ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, execution.workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(403, "FORBIDDEN", "You don't own this execution");
      }

      const steps = await db
        .select()
        .from(stepExecutions)
        .where(eq(stepExecutions.executionId, executionId))
        .orderBy(stepExecutions.startedAt);

      const response: ApiResponse = {
        success: true,
        data: steps,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);