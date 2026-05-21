import { Router, Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { parseExpression } from "cron-parser";
import { workflows, workflowNodes } from "@synchive/db";
import { ApiResponse } from "@synchive/shared-types";
import { authenticate } from "../middleware/auth";
import { db } from "../services/db.service";
import { createLogger } from "@synchive/logger";

const logger = createLogger({ service: "api-gateway" });
export const schedulerRouter = Router();
schedulerRouter.use(authenticate);

// GET /api/scheduler/schedules
// Returns all schedule-triggered workflows for the current user
schedulerRouter.get(
  "/schedules",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get all non-archived workflows for this user
      const userWorkflows = await db
        .select({
          id: workflows.id,
          name: workflows.name,
          description: workflows.description,
          status: workflows.status,
          updatedAt: workflows.updatedAt,
        })
        .from(workflows)
        .where(eq(workflows.createdBy, req.user!.userId));

      if (userWorkflows.length === 0) {
        return res.json({ success: true, data: [] } satisfies ApiResponse);
      }

      // Fetch all trigger nodes for these workflows
      const { inArray } = await import("drizzle-orm");
      const workflowIds = userWorkflows.map((w) => w.id);
      const triggerNodes = await db
        .select({
          id: workflowNodes.id,
          workflowId: workflowNodes.workflowId,
          config: workflowNodes.config,
        })
        .from(workflowNodes)
        .where(
          inArray(workflowNodes.workflowId, workflowIds)
        );

      // Filter to schedule-type triggers and compute next run
      const schedules = userWorkflows.flatMap((wf) => {
        const triggerNode = triggerNodes.find(
          (tn) =>
            tn.workflowId === wf.id &&
            (tn.config as Record<string, unknown>)?.triggerType === "schedule"
        );
        if (!triggerNode) return [];

        const config = triggerNode.config as Record<string, unknown>;
        const cronExpr = config.cronExpression as string | undefined;
        const timezone = (config.timezone as string | undefined) ?? "UTC";

        let nextRun: string | null = null;
        let prevRun: string | null = null;
        let description: string | null = null;

        if (cronExpr) {
          try {
            const interval = parseExpression(cronExpr, {
              tz: timezone,
              currentDate: new Date(),
            });
            nextRun = interval.next().toDate().toISOString();
            prevRun = interval.prev().toDate().toISOString();
          } catch {
            // invalid cron
          }

          // Human-readable description
          description = cronExpr;
        }

        return [{
          workflowId:  wf.id,
          name:        wf.name,
          description: wf.description ?? null,
          status:      wf.status,
          cronExpression: cronExpr ?? null,
          timezone,
          nextRun,
          prevRun,
          cronDescription: description,
          updatedAt:   wf.updatedAt,
        }];
      });

      logger.debug({ count: schedules.length }, "Returning schedules");
      res.json({ success: true, data: schedules } satisfies ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);
