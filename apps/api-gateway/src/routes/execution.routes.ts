import { Router, Request, Response, NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  workflowExecutions,
  stepExecutions,
  workflows,
  workflowVersions,
} from "@synchive/db";
import { subscribeToExecution, ExecutionEvent, enqueueExecution, ExecutionJobData } from "@synchive/queue";
import { ApiResponse } from "@synchive/shared-types";
import { authenticate } from "../middleware/auth";
import { db } from "../services/db.service";
import { AppError } from "../middleware/error-handler";
import { createLogger } from "@synchive/logger";

const logger = createLogger({ service: "api-gateway" });

export const executionRouter = Router();
executionRouter.use(authenticate);

// ─── GET /api/executions — paginated list ──────────────────────────────────
executionRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page   = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
      const limit  = Math.min(100, Math.max(10, parseInt(String(req.query.limit ?? "50"), 10)));
      const offset = (page - 1) * limit;

      const userWorkflows = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(eq(workflows.createdBy, req.user!.userId));

      const workflowIds = userWorkflows.map((w) => w.id);

      if (workflowIds.length === 0) {
        const response: ApiResponse = { success: true, data: [], meta: { page, limit, total: 0, hasMore: false } };
        return res.json(response);
      }

      const { inArray } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(workflowExecutions)
        .where(inArray(workflowExecutions.workflowId, workflowIds))
        .orderBy(desc(workflowExecutions.createdAt))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const data    = hasMore ? rows.slice(0, limit) : rows;

      res.json({ success: true, data, meta: { page, limit, hasMore } } satisfies ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/executions/:id/retry ───────────────────────────────────────
executionRouter.post(
  "/:executionId/retry",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executionId = req.params.executionId as string;

      const [original] = await db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!original) throw new AppError(404, "EXECUTION_NOT_FOUND", "Execution not found");

      const [workflow] = await db
        .select({ id: workflows.id, status: workflows.status, currentVersion: workflows.currentVersion })
        .from(workflows)
        .where(and(eq(workflows.id, original.workflowId), eq(workflows.createdBy, req.user!.userId)))
        .limit(1);

      if (!workflow) throw new AppError(403, "FORBIDDEN", "You don't own this execution");

      const retryable = ["failed", "cancelled", "timed_out"];
      if (!retryable.includes(original.status))
        throw new AppError(400, "NOT_RETRYABLE", `Cannot retry an execution with status '${original.status}'`);

      if (workflow.status !== "active")
        throw new AppError(400, "WORKFLOW_INACTIVE", "Cannot retry — workflow is not active");

      const [version] = await db
        .select()
        .from(workflowVersions)
        .where(and(eq(workflowVersions.workflowId, workflow.id), eq(workflowVersions.version, workflow.currentVersion)))
        .limit(1);

      if (!version) throw new AppError(500, "VERSION_MISSING", "No snapshot found");

      const [newExecution] = await db
        .insert(workflowExecutions)
        .values({ workflowId: original.workflowId, versionId: version.id, status: "queued", triggerData: original.triggerData ?? {} })
        .returning();

      const jobData: ExecutionJobData = {
        executionId: newExecution.id,
        workflowId:  original.workflowId,
        versionId:   version.id,
        triggeredBy: "manual",
        triggerData: (original.triggerData ?? {}) as Record<string, unknown>,
      };
      await enqueueExecution(jobData);

      logger.info({ newExecutionId: newExecution.id, originalId: executionId }, "Execution retried");
      res.status(202).json({ success: true, data: { executionId: newExecution.id } } satisfies ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/executions/:id/stream — SSE ─────────────────────────────────
executionRouter.get(
  "/:executionId/stream",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executionId = req.params.executionId as string;

      const [execution] = await db
        .select({ id: workflowExecutions.id, workflowId: workflowExecutions.workflowId, status: workflowExecutions.status })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!execution) throw new AppError(404, "EXECUTION_NOT_FOUND", "Execution not found");

      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(eq(workflows.id, execution.workflowId), eq(workflows.createdBy, req.user!.userId)))
        .limit(1);

      if (!workflow) throw new AppError(403, "FORBIDDEN", "You don't own this execution");

      const terminalStatuses = ["completed", "failed", "cancelled", "timed_out"];
      if (terminalStatuses.includes(execution.status)) {
        const steps = await db
          .select()
          .from(stepExecutions)
          .where(eq(stepExecutions.executionId, executionId))
          .orderBy(stepExecutions.startedAt);

        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });

        for (const step of steps) {
          const event: ExecutionEvent = {
            type: step.status === "completed" ? "step:completed" : "step:failed",
            executionId, workflowId: execution.workflowId,
            data: { nodeId: step.nodeId, status: step.status, output: step.output as Record<string, unknown> | undefined, error: step.error || undefined, attempt: step.attempt },
            timestamp: (step.completedAt || step.startedAt || new Date()).toISOString(),
          };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: execution.status === "completed" ? "execution:completed" : "execution:failed", executionId, workflowId: execution.workflowId, data: { status: execution.status }, timestamp: new Date().toISOString() })}\n\n`);
        res.end();
        return;
      }

      res.setMaxListeners(20);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
      res.write(`data: ${JSON.stringify({ type: "connected", executionId })}\n\n`);

      const subscriber = await subscribeToExecution(executionId, (event) => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (event.type === "execution:completed" || event.type === "execution:failed") {
            setTimeout(() => { subscriber.disconnect(); res.end(); }, 500);
          }
        } catch { subscriber.disconnect(); }
      });

      req.on("close", () => { logger.debug({ executionId }, "SSE client disconnected"); subscriber.disconnect(); });
      const timeout = setTimeout(() => { logger.debug({ executionId }, "SSE timed out"); subscriber.disconnect(); res.end(); }, 5 * 60 * 1000);
      req.on("close", () => clearTimeout(timeout));
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/executions/:id/steps ─────────────────────────────────────────
executionRouter.get(
  "/:executionId/steps",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executionId = req.params.executionId as string;

      const [execution] = await db
        .select({ id: workflowExecutions.id, workflowId: workflowExecutions.workflowId })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!execution) throw new AppError(404, "EXECUTION_NOT_FOUND", "Execution not found");

      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(eq(workflows.id, execution.workflowId), eq(workflows.createdBy, req.user!.userId)))
        .limit(1);

      if (!workflow) throw new AppError(403, "FORBIDDEN", "You don't own this execution");

      const steps = await db
        .select()
        .from(stepExecutions)
        .where(eq(stepExecutions.executionId, executionId))
        .orderBy(stepExecutions.startedAt);

      res.json({ success: true, data: steps } satisfies ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);