import {
  pgTable,
  uuid,
  timestamp,
  integer,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { executionStatusEnum, stepStatusEnum } from "./enums";
import { workflows, workflowVersions, workflowNodes } from "./workflows";

export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    versionId: uuid("version_id")
      .references(() => workflowVersions.id)
      .notNull(),
    status: executionStatusEnum("status").default("pending").notNull(),
    triggerData: jsonb("trigger_data"), // input that started this execution
    result: jsonb("result"), // final output
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_executions_workflow").on(table.workflowId),
    index("idx_executions_status").on(table.status),
    index("idx_executions_created").on(table.createdAt),
  ]
);

export const stepExecutions = pgTable(
  "step_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .references(() => workflowExecutions.id, { onDelete: "cascade" })
      .notNull(),
    nodeId: uuid("node_id")
      .references(() => workflowNodes.id)
      .notNull(),
    status: stepStatusEnum("status").default("pending").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    attempt: integer("attempt").default(1).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_steps_execution").on(table.executionId),
    index("idx_steps_node").on(table.nodeId),
    index("idx_steps_status").on(table.status),
  ]
);