/* ─── API ENVELOPE ────────────────────────────────────────── */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: Record<string, unknown>
}

/* ─── AUTH ────────────────────────────────────────────────── */
export interface AuthUser {
  userId: string
  email: string
  name: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  email: string
  password: string
  name: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

/* ─── ENUMS (mirror backend enums exactly) ────────────────── */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived'
export type NodeType = 'trigger' | 'action' | 'condition' | 'ai' | 'transformer' | 'loop'
export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'event'
export type ExecutionStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out'
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying' | 'timed_out'

/* ─── WORKFLOW ────────────────────────────────────────────── */
export interface Workflow {
  id: string
  name: string
  description: string | null
  status: WorkflowStatus
  triggerType: TriggerType
  createdBy: string
  createdAt: string
  updatedAt: string
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
}

/* ─── NODES ───────────────────────────────────────────────── */
export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  backoffMultiplier: number
}

export interface NodePosition {
  x: number
  y: number
}

export interface WorkflowNode {
  id: string
  workflowId: string
  name: string
  type: NodeType
  config: Record<string, unknown>
  position: NodePosition
  retryPolicy: RetryPolicy
  timeoutMs: number
  createdAt: string
  updatedAt: string
}

/* ─── EDGES ───────────────────────────────────────────────── */
export interface WorkflowEdge {
  id: string
  workflowId: string
  sourceNodeId: string
  targetNodeId: string
  conditionExpression: string | null
  label: string | null
  createdAt: string
}

/* ─── EXECUTIONS ──────────────────────────────────────────── */
export interface WorkflowExecution {
  id: string
  workflowId: string
  versionId: string | null
  status: ExecutionStatus
  triggerData: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  createdAt: string
}

export interface StepExecution {
  id: string
  executionId: string
  nodeId: string
  attempt: number
  status: StepStatus
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

/* ─── REACT FLOW NODE DATA ────────────────────────────────── */
export interface FlowNodeData {
  workflowNode: WorkflowNode
  executionStatus?: StepStatus
  isSelected?: boolean
}

/* ─── SSE EVENTS ──────────────────────────────────────────── */
export type SseEventType =
  | 'execution:started'
  | 'execution:completed'
  | 'execution:failed'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'step:retrying'

export interface SseEvent {
  type: SseEventType
  executionId: string
  nodeId?: string
  status?: ExecutionStatus | StepStatus
  error?: string
  timestamp: string
}
