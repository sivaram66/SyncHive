CREATE TYPE "public"."execution_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('trigger', 'action', 'condition', 'loop', 'ai', 'transformer', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped', 'retrying', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'webhook', 'cron', 'event');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflow_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"condition_expression" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"type" "node_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" jsonb DEFAULT '{"x":0,"y":0}'::jsonb NOT NULL,
	"retry_policy" jsonb DEFAULT '{"maxRetries":0,"backoffMs":1000,"backoffMultiplier":2}'::jsonb NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"status" "execution_status" DEFAULT 'pending' NOT NULL,
	"trigger_data" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_source_node_id_workflow_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_target_node_id_workflow_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_executions" ADD CONSTRAINT "step_executions_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_executions" ADD CONSTRAINT "step_executions_node_id_workflow_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_edges_workflow" ON "workflow_edges" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_edges_source" ON "workflow_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "workflow_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "idx_nodes_workflow" ON "workflow_nodes" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_nodes_type" ON "workflow_nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_wv_workflow_version" ON "workflow_versions" USING btree ("workflow_id","version");--> statement-breakpoint
CREATE INDEX "idx_workflows_created_by" ON "workflows" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_workflows_status" ON "workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_steps_execution" ON "step_executions" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_steps_node" ON "step_executions" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "idx_steps_status" ON "step_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_executions_workflow" ON "workflow_executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_executions_status" ON "workflow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_executions_created" ON "workflow_executions" USING btree ("created_at");