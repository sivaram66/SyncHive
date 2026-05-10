import { useState, useEffect, useCallback, useRef } from 'react'
import { workflowsApi } from '@/lib/api'
import { useWorkflowStore, useExecutionLiveStore } from '@/lib/store'
import type { SseEvent } from '@/types'

/* ─── useWorkflows ─────────────────────────────────────────── */
export function useWorkflows() {
  const { workflows, setWorkflows } = useWorkflowStore()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await workflowsApi.list()
      if (res.success && res.data) setWorkflows(res.data)
    } catch {
      setError('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [setWorkflows])

  useEffect(() => { fetch() }, [fetch])

  return { workflows, loading, error, refetch: fetch }
}

/* ─── useWorkflow ──────────────────────────────────────────── */
export function useWorkflow(id: string | undefined) {
  const { activeWorkflow, setActiveWorkflow } = useWorkflowStore()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await workflowsApi.get(id)
      if (res.success && res.data) setActiveWorkflow(res.data)
    } catch {
      setError('Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }, [id, setActiveWorkflow])

  useEffect(() => { fetch() }, [fetch])

  return { workflow: activeWorkflow, loading, error, refetch: fetch }
}

/* ─── useExecutions ────────────────────────────────────────── */
export function useExecutions(workflowId: string | undefined) {
  const { executions, setExecutions } = useWorkflowStore()
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!workflowId) return
    setLoading(true)
    try {
      const res = await workflowsApi.executions(workflowId)
      if (res.success && res.data) setExecutions(res.data)
    } finally {
      setLoading(false)
    }
  }, [workflowId, setExecutions])

  useEffect(() => { fetch() }, [fetch])

  return { executions, loading, refetch: fetch }
}

/* ─── useSSE ───────────────────────────────────────────────── */
export function useSSE(executionId: string | null) {
  const { applySSEEvent, setActiveExecution } = useExecutionLiveStore()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Close any existing connection
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    // Nothing to subscribe to
    if (!executionId) return

    const token = localStorage.getItem('sh_token')
    if (!token) return

    setActiveExecution(executionId)

    // Open SSE connection to backend
    // Note: EventSource doesn't support custom headers natively.
    // We pass the token as a query param — api-gateway must accept ?token=
    const url = `/api/executions/${executionId}/stream?token=${token}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      console.debug(`[SSE] Connected to execution ${executionId}`)
    }

    es.onmessage = (e) => {
      try {
        const event: SseEvent = JSON.parse(e.data)
        applySSEEvent(event)
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      console.debug(`[SSE] Connection error for execution ${executionId}`)
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [executionId, applySSEEvent, setActiveExecution])
}