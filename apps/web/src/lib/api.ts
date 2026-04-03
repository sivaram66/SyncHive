import axios from 'axios'
import type {
  ApiResponse, AuthResponse, LoginPayload, SignupPayload,
  Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution,
} from '@/types'

/* ─── AXIOS INSTANCE ──────────────────────────────────────── */
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sh_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sh_token')
      localStorage.removeItem('sh_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/* ─── AUTH ────────────────────────────────────────────────── */
export const authApi = {
  signup: (payload: SignupPayload) =>
    api.post<ApiResponse<AuthResponse>>('/auth/signup', payload).then(r => r.data),

  login: (payload: LoginPayload) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', payload).then(r => r.data),
}

/* ─── WORKFLOWS ───────────────────────────────────────────── */
export const workflowsApi = {
  list: () =>
    api.get<ApiResponse<Workflow[]>>('/workflows').then(r => r.data),

  get: (id: string) =>
    api.get<ApiResponse<Workflow>>(`/workflows/${id}`).then(r => r.data),

  create: (payload: { name: string; description?: string; triggerType: string }) =>
    api.post<ApiResponse<Workflow>>('/workflows', payload).then(r => r.data),

  update: (id: string, payload: Partial<Pick<Workflow, 'name' | 'description' | 'status'>>) =>
    api.patch<ApiResponse<Workflow>>(`/workflows/${id}`, payload).then(r => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/workflows/${id}`).then(r => r.data),

  activate: (id: string) =>
    api.post<ApiResponse<Workflow>>(`/workflows/${id}/activate`).then(r => r.data),

  execute: (id: string, triggerData?: Record<string, unknown>) =>
    api.post<ApiResponse<{ executionId: string }>>(`/workflows/${id}/execute`, { triggerData }).then(r => r.data),

  executions: (id: string) =>
    api.get<ApiResponse<WorkflowExecution[]>>(`/workflows/${id}/executions`).then(r => r.data),
}

/* ─── NODES ───────────────────────────────────────────────── */
export const nodesApi = {
  create: (workflowId: string, payload: {
    name: string
    type: string
    config?: Record<string, unknown>
    position?: { x: number; y: number }
    retryPolicy?: { maxRetries: number; backoffMs: number; backoffMultiplier: number }
    timeoutMs?: number
  }) =>
    api.post<ApiResponse<WorkflowNode>>(`/workflows/${workflowId}/nodes`, payload).then(r => r.data),

  update: (workflowId: string, nodeId: string, payload: Partial<{
    name: string
    config: Record<string, unknown>
    position: { x: number; y: number }
    retryPolicy: { maxRetries: number; backoffMs: number; backoffMultiplier: number }
    timeoutMs: number
  }>) =>
    api.patch<ApiResponse<WorkflowNode>>(`/workflows/${workflowId}/nodes/${nodeId}`, payload).then(r => r.data),

  delete: (workflowId: string, nodeId: string) =>
    api.delete<ApiResponse<null>>(`/workflows/${workflowId}/nodes/${nodeId}`).then(r => r.data),
}

/* ─── EDGES ───────────────────────────────────────────────── */
export const edgesApi = {
  create: (workflowId: string, payload: {
    sourceNodeId: string
    targetNodeId: string
    conditionExpression?: string
    label?: string
  }) =>
    api.post<ApiResponse<WorkflowEdge>>(`/workflows/${workflowId}/edges`, payload).then(r => r.data),

  delete: (workflowId: string, edgeId: string) =>
    api.delete<ApiResponse<null>>(`/workflows/${workflowId}/edges/${edgeId}`).then(r => r.data),
}

export default api
