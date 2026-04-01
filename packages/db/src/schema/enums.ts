import { pgEnum } from "drizzle-orm/pg-core";

export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const nodeTypeEnum = pgEnum("node_type", [
  "trigger",
  "action",
  "condition",
  "loop",
  "ai",
  "transformer",
  "webhook",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "retrying",
  "timed_out",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "manual",
  "webhook",
  "cron",
  "event",
]);