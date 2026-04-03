import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, Workflow, WorkflowExecution, SseEvent, StepStatus } from '@/types'

/* ─── THEME STORE ─────────────────────────────────────────── */
interface ThemeStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        set({ theme: next })
      },
    }),
    { name: 'sh_theme' }
  )
)

/* ─── AUTH STORE ──────────────────────────────────────────── */
interface AuthStore {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('sh_token', token)
        set({ token, user })
      },
      clearAuth: () => {
        localStorage.removeItem('sh_token')
        localStorage.removeItem('sh_user')
        set({ token: null, user: null })
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: 'sh_auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)

/* ─── WORKFLOW STORE ──────────────────────────────────────── */
interface WorkflowStore {
  workflows: Workflow[]
  activeWorkflow: Workflow | null
  executions: WorkflowExecution[]
  setWorkflows: (workflows: Workflow[]) => void
  setActiveWorkflow: (workflow: Workflow | null) => void
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void
  removeWorkflow: (id: string) => void
  setExecutions: (executions: WorkflowExecution[]) => void
  addExecution: (execution: WorkflowExecution) => void
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflows: [],
  activeWorkflow: null,
  executions: [],
  setWorkflows: (workflows) => set({ workflows }),
  setActiveWorkflow: (activeWorkflow) => set({ activeWorkflow }),
  updateWorkflow: (id, updates) =>
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      activeWorkflow: s.activeWorkflow?.id === id
        ? { ...s.activeWorkflow, ...updates }
        : s.activeWorkflow,
    })),
  removeWorkflow: (id) =>
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      activeWorkflow: s.activeWorkflow?.id === id ? null : s.activeWorkflow,
    })),
  setExecutions: (executions) => set({ executions }),
  addExecution: (execution) =>
    set((s) => ({ executions: [execution, ...s.executions] })),
}))

/* ─── EXECUTION LIVE STORE (SSE state) ────────────────────── */
interface ExecutionLiveStore {
  activeExecutionId: string | null
  nodeStatuses: Record<string, StepStatus>
  setActiveExecution: (id: string | null) => void
  applySSEEvent: (event: SseEvent) => void
  reset: () => void
}

export const useExecutionLiveStore = create<ExecutionLiveStore>((set) => ({
  activeExecutionId: null,
  nodeStatuses: {},
  setActiveExecution: (id) => set({ activeExecutionId: id, nodeStatuses: {} }),
  applySSEEvent: (event) => {
    if (event.nodeId) {
      set((s) => ({
        nodeStatuses: {
          ...s.nodeStatuses,
          [event.nodeId!]: event.status as StepStatus,
        },
      }))
    }
  },
  reset: () => set({ activeExecutionId: null, nodeStatuses: {} }),
}))
