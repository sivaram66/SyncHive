import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import {
  workflowStatusEnum,
  nodeTypeEnum,
  triggerTypeEnum,
} from "./enums";

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").default("draft").notNull(),
    createdBy: uuid("created_by").notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_workflows_created_by").on(table.createdBy),
    index("idx_workflows_status").on(table.status),
  ]
);

export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(), // full graph snapshot at this version
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_wv_workflow_version").on(table.workflowId, table.version),
  ]
);

export const workflowNodes = pgTable(
  "workflow_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    type: nodeTypeEnum("type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    config: jsonb("config").default({}).notNull(), // node-specific settings
    position: jsonb("position").default({ x: 0, y: 0 }).notNull(), // canvas position
    retryPolicy: jsonb("retry_policy").default({
      maxRetries: 0,
      backoffMs: 1000,
      backoffMultiplier: 2,
    }).notNull(),
    timeoutMs: integer("timeout_ms").default(30000).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_nodes_workflow").on(table.workflowId),
    index("idx_nodes_type").on(table.type),
  ]
);

export const workflowEdges = pgTable(
  "workflow_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    sourceNodeId: uuid("source_node_id")
      .references(() => workflowNodes.id, { onDelete: "cascade" })
      .notNull(),
    targetNodeId: uuid("target_node_id")
      .references(() => workflowNodes.id, { onDelete: "cascade" })
      .notNull(),
    conditionExpression: text("condition_expression"), // for conditional branches
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_edges_workflow").on(table.workflowId),
    index("idx_edges_source").on(table.sourceNodeId),
    index("idx_edges_target").on(table.targetNodeId),
  ]
);