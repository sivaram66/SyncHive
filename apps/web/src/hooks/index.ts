import { useState, useEffect, useCallback, useRef } from 'react'
import { workflowsApi } from '@/lib/api'
import { useWorkflowStore, useExecutionLiveStore } from '@/lib/store'
import type { SseEvent } from '@/types'

/* ─── useWorkflows ────────────────────────────────────────── */
export function useWorkflows() {
  const { workflows, setWorkflows } = useWorkflowStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

/* ─── useWorkflow (single, with nodes + edges) ────────────── */
export function useWorkflow(id: string | undefined) {
  const { activeWorkflow, setActiveWorkflow } = useWorkflowStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

/* ─── useExecutions ───────────────────────────────────────── */
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

/* ─── useSSE — connect to execution SSE stream ────────────── */
export function useSSE(executionId: string | null) {
  const { applySSEEvent, setActiveExecution } = useExecutionLiveStore()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!esRef.current) return
    esRef.current.close()
    esRef.current = null

    if (!executionId) return

    setActiveExecution(executionId)
    // SSE endpoint — adjust if you add one to api-gateway
    const es = new EventSource(`/api/executions/${executionId}/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event: SseEvent = JSON.parse(e.data)
        applySSEEvent(event)
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => { es.close() }

    return () => { es.close() }
  }, [executionId, applySSEEvent, setActiveExecution])
}
