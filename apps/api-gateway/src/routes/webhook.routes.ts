import { Router, Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import {
  workflows,
  workflowNodes,
  workflowVersions,
  workflowExecutions,
} from "@synchive/db";
import { ApiResponse } from "@synchive/shared-types";
import { db } from "../services/db.service";
import { enqueueExecution, ExecutionJobData, getRedisConnection } from "@synchive/queue";
import { createLogger } from "@synchive/logger";
import { AppError } from "../middleware/error-handler";

const logger = createLogger({ service: "api-gateway" });
const DELIVERY_DEDUP_TTL_SECONDS = 24 * 60 * 60;

/**
 * Verify GitHub-style HMAC-SHA256 webhook signature.
 * Header format: "sha256=<hex-digest>"
 * Uses timingSafeEqual to prevent timing-based attacks.
 */
function verifyWebhookSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader) return false;
  const [algo, receivedHex] = signatureHeader.split("=");
  if (algo !== "sha256" || !receivedHex) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expectedHex, "hex"));
  } catch {
    return false; // buffer length mismatch = invalid
  }
}


export const webhookRouter = Router();

// Catch-all webhook handler: POST /hooks/:path
webhookRouter.post(
  "/:webhookPath",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookPath = req.params.webhookPath as string;
      const fullPath = `/hooks/${webhookPath}`;

      logger.info({ path: fullPath }, "Webhook received");

      // ── Idempotency: deduplicate GitHub retries ──────────────────────────────
      // GitHub sends X-GitHub-Delivery (a UUID) per unique delivery.
      // If it retries a failed delivery, the UUID is the same — we skip it.
      const deliveryId = req.headers['x-github-delivery'] as string | undefined;
      if (deliveryId) {
        const redis = getRedisConnection();
        const dedupKey = `webhook:delivery:${deliveryId}`;
        const alreadyProcessed = await redis.set(dedupKey, '1', 'EX', DELIVERY_DEDUP_TTL_SECONDS, 'NX');
        if (alreadyProcessed === null) {
          // NX failed — key already existed — this is a duplicate delivery
          logger.info({ deliveryId, path: fullPath }, 'Duplicate webhook delivery — skipping');
          res.status(200).json({ success: true, data: { status: 'deduplicated', deliveryId } });
          return;
        }
      }

      // Find active trigger nodes of type webhook that match this path
      // Nodes are stored as type="trigger" with config.triggerType="webhook"
      const allTriggerNodes = await db
        .select({
          nodeId: workflowNodes.id,
          workflowId: workflowNodes.workflowId,
          config: workflowNodes.config,
        })
        .from(workflowNodes)
        .where(eq(workflowNodes.type, "trigger"));

      // Match by path — stored in config.path, support both with and without /hooks/ prefix
      // triggerType defaults to 'webhook' if not explicitly set (matches UI default)
      const requestAction = (req.body as Record<string, unknown>)?.action as string | undefined;

      const matchedNode = allTriggerNodes.find((node) => {
        const config = node.config as { triggerType?: string; path?: string; action?: string };
        const triggerType = config.triggerType ?? 'webhook';
        if (triggerType !== "webhook") return false;
        const storedPath = config.path ?? "";
        const pathMatch = storedPath === fullPath || storedPath === `/${webhookPath}` || storedPath === webhookPath;
        if (!pathMatch) return false;
        // If trigger has an action filter, only process matching actions (e.g. "created" not "deleted")
        if (config.action && requestAction && config.action !== requestAction) return false;
        return true;
      });

      if (!matchedNode) {
        // If no node matched, check if it's a filtered-out action (e.g. star.deleted)
        const hasPathMatch = allTriggerNodes.some((node) => {
          const config = node.config as { triggerType?: string; path?: string };
          const triggerType = config.triggerType ?? 'webhook';
          if (triggerType !== "webhook") return false;
          const storedPath = config.path ?? "";
          return storedPath === fullPath || storedPath === `/${webhookPath}` || storedPath === webhookPath;
        });
        if (hasPathMatch) {
          // Path matched but action was filtered out — acknowledge silently
          logger.info({ path: fullPath, action: requestAction }, "Webhook action filtered out, skipping execution");
          res.status(200).json({ success: true, data: { status: "filtered", reason: `action '${requestAction}' not configured for this trigger` } });
          return;
        }
        throw new AppError(404, "WEBHOOK_NOT_FOUND", "No workflow registered for this webhook path");
      }

      // ── Signature verification ──────────────────────────────────────────────
      // If the trigger node has config.webhookSecret set, verify HMAC-SHA256.
      // Supports: X-Hub-Signature-256 (GitHub), X-Signature-256, X-Webhook-Signature
      const nodeConfig = matchedNode.config as Record<string, unknown>;
      const webhookSecret = nodeConfig.webhookSecret as string | undefined;

      if (webhookSecret) {
        const signatureHeader =
          (req.headers['x-hub-signature-256'] as string | undefined) ||
          (req.headers['x-signature-256']     as string | undefined) ||
          (req.headers['x-webhook-signature'] as string | undefined);

        // Use rawBody buffer stored by Express bodyParser (see app.ts verify callback)
        const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));

        const isValid = verifyWebhookSignature(webhookSecret, rawBody, signatureHeader);
        if (!isValid) {
          logger.warn({ path: fullPath, hasSignatureHeader: !!signatureHeader }, "Webhook signature verification failed");
          throw new AppError(401, "INVALID_SIGNATURE", "Webhook signature verification failed");
        }
        logger.info({ path: fullPath }, "Webhook signature verified ✓");
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
        triggeredBy: 'webhook',
        triggerData,
      };
      await enqueueExecution(jobData);

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
