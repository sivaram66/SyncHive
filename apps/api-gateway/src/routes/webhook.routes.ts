import { Router, Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import {
  workflows,
  workflowNodes,
  workflowVersions,
  workflowExecutions,
} from "@synchive/db";
import { ApiResponse } from "@synchive/shared-types";
import { db } from "../services/db.service";
import { executionQueue } from "../services/queue.service";
import { enqueueExecution, ExecutionJobData } from "@synchive/queue";
import { createLogger } from "@synchive/logger";
import { AppError } from "../middleware/error-handler";

const logger = createLogger({ service: "api-gateway" });

export const webhookRouter = Router();

// Catch-all webhook handler: POST /hooks/:path
webhookRouter.post(
  "/:webhookPath",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { webhookPath } = req.params;
      const fullPath = `/hooks/${webhookPath}`;

      logger.info({ path: fullPath }, "Webhook received");

      // Find the webhook node that matches this path
      const allWebhookNodes = await db
        .select({
          nodeId: workflowNodes.id,
          workflowId: workflowNodes.workflowId,
          config: workflowNodes.config,
        })
        .from(workflowNodes)
        .where(eq(workflowNodes.type, "webhook"));

      // Match by path in config
      const matchedNode = allWebhookNodes.find((node) => {
        const config = node.config as { path?: string };
        return config.path === fullPath;
      });

      if (!matchedNode) {
        throw new AppError(404, "WEBHOOK_NOT_FOUND", "No workflow registered for this webhook path");
      }

      // Verify the workflow is active
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.id, matchedNode.workflowId),
            eq(workflows.status, "active")
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(400, "WORKFLOW_INACTIVE", "The workflow for this webhook is not active");
      }

      // Get current version
      const [version] = await db
        .select()
        .from(workflowVersions)
        .where(
          and(
            eq(workflowVersions.workflowId, workflow.id),
            eq(workflowVersions.version, workflow.currentVersion)
          )
        )
        .limit(1);

      if (!version) {
        throw new AppError(500, "VERSION_MISSING", "No version snapshot found for active workflow");
      }

      // Create execution
      const triggerData = {
        webhookPath: fullPath,
        headers: req.headers,
        body: req.body,
        receivedAt: new Date().toISOString(),
      };

      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowId: workflow.id,
          versionId: version.id,
          status: "queued",
          triggerData,
        })
        .returning();

      // Enqueue for processing
      const jobData: ExecutionJobData = {
        executionId: execution.id,
        workflowId: workflow.id,
        versionId: version.id,
        triggerData,
      };

      await enqueueExecution(executionQueue, jobData);

      logger.info(
        {
          executionId: execution.id,
          workflowId: workflow.id,
          webhookPath: fullPath,
        },
        "Webhook execution enqueued"
      );

      // Return 202 immediately — don't make the external service wait
      const response: ApiResponse = {
        success: true,
        data: {
          executionId: execution.id,
          status: "queued",
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }
);
