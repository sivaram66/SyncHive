import { Router, Request, Response, NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  workflows,
  workflowNodes,
  workflowEdges,
  workflowVersions,
  workflowExecutions,
} from "@synchive/db";
import { ApiResponse, WorkflowSnapshot } from "@synchive/shared-types";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
} from "../utils/schemas";
import { db } from "../services/db.service";
import { executionQueue } from "../services/queue.service";
import { enqueueExecution, ExecutionJobData } from "@synchive/queue";
import { AppError } from "../middleware/error-handler";

export const workflowRouter = Router();

// All workflow routes require authentication
workflowRouter.use(authenticate);

// ==================== WORKFLOWS ====================

// List all workflows for the authenticated user
workflowRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userWorkflows = await db
        .select()
        .from(workflows)
        .where(eq(workflows.createdBy, req.user!.userId))
        .orderBy(desc(workflows.updatedAt));

      const response: ApiResponse = {
        success: true,
        data: userWorkflows,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Get a single workflow with its nodes and edges
workflowRouter.get(
  "/:workflowId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      const [workflow] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(eq(workflowNodes.workflowId, workflowId));

      const edges = await db
        .select()
        .from(workflowEdges)
        .where(eq(workflowEdges.workflowId, workflowId));

      const response: ApiResponse = {
        success: true,
        data: {
          ...workflow,
          nodes,
          edges,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Create a new workflow
workflowRouter.post(
  "/",
  validate(createWorkflowSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;

      const [workflow] = await db
        .insert(workflows)
        .values({
          name,
          description,
          createdBy: req.user!.userId,
        })
        .returning();

      const response: ApiResponse = {
        success: true,
        data: workflow,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Update a workflow
workflowRouter.patch(
  "/:workflowId",
  validate(updateWorkflowSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      const [updated] = await db
        .update(workflows)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .returning();

      if (!updated) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const response: ApiResponse = {
        success: true,
        data: updated,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a workflow
workflowRouter.delete(
  "/:workflowId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      const [deleted] = await db
        .delete(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .returning();

      if (!deleted) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const response: ApiResponse = {
        success: true,
        data: { id: deleted.id, deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== ACTIVATE WORKFLOW ====================

workflowRouter.post(
  "/:workflowId/activate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      // Verify ownership
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      // Load nodes and edges
      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(eq(workflowNodes.workflowId, workflowId));

      const edges = await db
        .select()
        .from(workflowEdges)
        .where(eq(workflowEdges.workflowId, workflowId));

      // Validate: must have at least one trigger node
      const triggerNodes = nodes.filter(
        (n) => n.type === "trigger" || n.type === "webhook"
      );
      if (triggerNodes.length === 0) {
        throw new AppError(
          400,
          "NO_TRIGGER",
          "Workflow must have at least one trigger node"
        );
      }

      // Validate: must have at least one edge
      if (edges.length === 0 && nodes.length > 1) {
        throw new AppError(
          400,
          "NO_EDGES",
          "Workflow nodes must be connected with edges"
        );
      }

      // Create version snapshot
      const newVersion = workflow.currentVersion + 1;

      const snapshot: WorkflowSnapshot = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as WorkflowSnapshot["nodes"][0]["type"],
          name: n.name,
          config: n.config as Record<string, unknown>,
          retryPolicy: n.retryPolicy as {
            maxRetries: number;
            backoffMs: number;
            backoffMultiplier: number;
          },
          timeoutMs: n.timeoutMs,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          conditionExpression: e.conditionExpression,
        })),
      };

      // Transaction: create version + update workflow status
      const [version] = await db
        .insert(workflowVersions)
        .values({
          workflowId,
          version: newVersion,
          snapshot: snapshot,
          changelog: `Version ${newVersion} - activated`,
        })
        .returning();

      await db
        .update(workflows)
        .set({
          status: "active",
          currentVersion: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, workflowId));

      const response: ApiResponse = {
        success: true,
        data: {
          workflowId,
          version: newVersion,
          versionId: version.id,
          status: "active",
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== NODES ====================

// Add a node to a workflow
workflowRouter.post(
  "/:workflowId/nodes",
  validate(createNodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const { type, name, config, position, retryPolicy, timeoutMs } =
        req.body;

      const [node] = await db
        .insert(workflowNodes)
        .values({
          workflowId,
          type,
          name,
          config,
          position,
          retryPolicy: retryPolicy || {
            maxRetries: 0,
            backoffMs: 1000,
            backoffMultiplier: 2,
          },
          timeoutMs,
        })
        .returning();

      const response: ApiResponse = {
        success: true,
        data: node,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Update a node
workflowRouter.patch(
  "/:workflowId/nodes/:nodeId",
  validate(updateNodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, nodeId } = req.params;

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const [updated] = await db
        .update(workflowNodes)
        .set(req.body)
        .where(
          and(
            eq(workflowNodes.id, nodeId),
            eq(workflowNodes.workflowId, workflowId)
          )
        )
        .returning();

      if (!updated) {
        throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
      }

      const response: ApiResponse = {
        success: true,
        data: updated,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a node
workflowRouter.delete(
  "/:workflowId/nodes/:nodeId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, nodeId } = req.params;

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const [deleted] = await db
        .delete(workflowNodes)
        .where(
          and(
            eq(workflowNodes.id, nodeId),
            eq(workflowNodes.workflowId, workflowId)
          )
        )
        .returning();

      if (!deleted) {
        throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
      }

      // Edges are cascade-deleted by Postgres

      const response: ApiResponse = {
        success: true,
        data: { id: deleted.id, deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== EDGES ====================

// Add an edge
workflowRouter.post(
  "/:workflowId/edges",
  validate(createEdgeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const { sourceNodeId, targetNodeId, conditionExpression } = req.body;

      // Verify both nodes belong to this workflow
      const sourceNode = await db
        .select({ id: workflowNodes.id })
        .from(workflowNodes)
        .where(
          and(
            eq(workflowNodes.id, sourceNodeId),
            eq(workflowNodes.workflowId, workflowId)
          )
        )
        .limit(1);

      const targetNode = await db
        .select({ id: workflowNodes.id })
        .from(workflowNodes)
        .where(
          and(
            eq(workflowNodes.id, targetNodeId),
            eq(workflowNodes.workflowId, workflowId)
          )
        )
        .limit(1);

      if (sourceNode.length === 0) {
        throw new AppError(400, "INVALID_SOURCE", "Source node not found in this workflow");
      }

      if (targetNode.length === 0) {
        throw new AppError(400, "INVALID_TARGET", "Target node not found in this workflow");
      }

      const [edge] = await db
        .insert(workflowEdges)
        .values({
          workflowId,
          sourceNodeId,
          targetNodeId,
          conditionExpression: conditionExpression || null,
        })
        .returning();

      const response: ApiResponse = {
        success: true,
        data: edge,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Delete an edge
workflowRouter.delete(
  "/:workflowId/edges/:edgeId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, edgeId } = req.params;

      // Verify workflow ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const [deleted] = await db
        .delete(workflowEdges)
        .where(
          and(
            eq(workflowEdges.id, edgeId),
            eq(workflowEdges.workflowId, workflowId)
          )
        )
        .returning();

      if (!deleted) {
        throw new AppError(404, "EDGE_NOT_FOUND", "Edge not found");
      }

      const response: ApiResponse = {
        success: true,
        data: { id: deleted.id, deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== EXECUTIONS ====================

// Manually trigger a workflow execution
workflowRouter.post(
  "/:workflowId/execute",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      // Load workflow and verify ownership + active status
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      if (workflow.status !== "active") {
        throw new AppError(
          400,
          "WORKFLOW_NOT_ACTIVE",
          "Workflow must be active to execute. Current status: " +
            workflow.status
        );
      }

      // Get current version
      const [version] = await db
        .select()
        .from(workflowVersions)
        .where(
          and(
            eq(workflowVersions.workflowId, workflowId),
            eq(workflowVersions.version, workflow.currentVersion)
          )
        )
        .limit(1);

      if (!version) {
        throw new AppError(
          500,
          "VERSION_NOT_FOUND",
          "Active workflow has no version snapshot"
        );
      }

      // Create execution record
      const triggerData = req.body || {};

      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowId,
          versionId: version.id,
          status: "pending",
          triggerData,
        })
        .returning();

      // Push to execution queue
      const jobData: ExecutionJobData = {
        executionId: execution.id,
        workflowId,
        versionId: version.id,
        triggerData,
      };

      await enqueueExecution(executionQueue, jobData);

      // Update execution status to queued
      await db
        .update(workflowExecutions)
        .set({ status: "queued" })
        .where(eq(workflowExecutions.id, execution.id));

      const response: ApiResponse = {
        success: true,
        data: {
          executionId: execution.id,
          status: "queued",
          workflowId,
          versionId: version.id,
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Get execution history for a workflow
workflowRouter.get(
  "/:workflowId/executions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;

      // Verify ownership
      const [workflow] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.createdBy, req.user!.userId)
          )
        )
        .limit(1);

      if (!workflow) {
        throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
      }

      const executions = await db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, workflowId))
        .orderBy(desc(workflowExecutions.createdAt))
        .limit(50);

      const response: ApiResponse = {
        success: true,
        data: executions,
        meta: { total: executions.length, limit: 50 },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);