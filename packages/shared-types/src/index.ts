// Workflow status types
export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type NodeType =
  | "trigger"
  | "action"
  | "condition"
  | "loop"
  | "ai"
  | "transformer"
  | "webhook";
export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "retrying"
  | "timed_out";
export type TriggerType = "manual" | "webhook" | "cron" | "event";

// API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Retry policy shared between DB and engine
export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

// Node position on canvas
export interface NodePosition {
  x: number;
  y: number;
}

// Version snapshot structure
export interface WorkflowSnapshot {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

export interface SnapshotNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  retryPolicy: RetryPolicy;
  timeoutMs: number;
}

export interface SnapshotEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionExpression: string | null;
}

// SSE event types for real-time updates
export type SSEEventType =
  | "execution:started"
  | "execution:completed"
  | "execution:failed"
  | "step:started"
  | "step:completed"
  | "step:failed"
  | "step:retrying";

export interface SSEEvent {
  type: SSEEventType;
  executionId: string;
  data: Record<string, unknown>;
  timestamp: string;
}
