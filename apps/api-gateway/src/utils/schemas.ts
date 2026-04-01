import { z } from "zod";

// Auth schemas
export const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name must be at most 255 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255)
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// Workflow schemas
export const createWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Workflow name is required")
    .max(255, "Workflow name must be at most 255 characters")
    .trim(),
  description: z.string().max(2000).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
});

// Node schemas
export const createNodeSchema = z.object({
  type: z.enum([
    "trigger",
    "action",
    "condition",
    "loop",
    "ai",
    "transformer",
    "webhook",
  ]),
  name: z.string().min(1).max(255).trim(),
  config: z.record(z.unknown()).default({}),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .default({ x: 0, y: 0 }),
  retryPolicy: z
    .object({
      maxRetries: z.number().min(0).max(10).default(0),
      backoffMs: z.number().min(100).max(60000).default(1000),
      backoffMultiplier: z.number().min(1).max(5).default(2),
    })
    .optional(),
  timeoutMs: z.number().min(1000).max(300000).default(30000),
});

export const updateNodeSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  config: z.record(z.unknown()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().min(0).max(10),
      backoffMs: z.number().min(100).max(60000),
      backoffMultiplier: z.number().min(1).max(5),
    })
    .optional(),
  timeoutMs: z.number().min(1000).max(300000).optional(),
});

// Edge schemas
export const createEdgeSchema = z.object({
  sourceNodeId: z.string().uuid("Invalid source node ID"),
  targetNodeId: z.string().uuid("Invalid target node ID"),
  conditionExpression: z.string().max(1000).nullable().optional(),
});