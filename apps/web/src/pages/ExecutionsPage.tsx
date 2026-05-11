import { useState, useCallback } from 'react'
import { useWorkflowStore } from '@/lib/store'
import { executionsApi } from '@/lib/api'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'
import type { ExecutionStatus, StepExecution, StepStatus } from '@/types'
import styles from './ExecutionsPage.module.css'

const STATUS_FILTERS = ['All', 'Running', 'Completed', 'Failed'] as const
type Filter = typeof STATUS_FILTERS[number]

export function ExecutionsPage() {
  const { executions } = useWorkflowStore()
  const [activeFilter,   setActiveFilter]   = useState<Filter>('All')
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [steps,          setSteps]          = useState<StepExecution[]>([])
  const [stepsLoading,   setStepsLoading]   = useState(false)
  const [stepsError,     setStepsError]     = useState<string | null>(null)

  const filtered = executions.filter((ex) => {
    if (activeFilter === 'All') return true
    return ex.status.toLowerCase() === activeFilter.toLowerCase()
  })

  const stats = {
    total:     executions.length,
    running:   executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed:    executions.filter(e => e.status === 'failed').length,
  }

  const handleRowClick = useCallback(async (executionId: string) => {
    if (expandedId === executionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(executionId)
    setSteps([])
    setStepsError(null)
    setStepsLoading(true)
    try {
      const res = await executionsApi.steps(executionId)
      if (res.success && res.data) setSteps(res.data)
      else setStepsError(res.error ?? 'Failed to load steps')
    } catch {
      setStepsError('Failed to load step details')
    } finally {
      setStepsLoading(false)
    }
  }, [expandedId])

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Executions</h1>
          <p className={styles.sub}>Real-time view of all workflow runs — click any row to see step details</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className={styles.statsRow}>
        {[
          { label: 'Total Runs',  value: stats.total,     mod: '' },
          { label: 'Running',     value: stats.running,   mod: styles.valueRunning },
          { label: 'Completed',   value: stats.completed, mod: styles.valueGreen },
          { label: 'Failed',      value: stats.failed,    mod: styles.valueFailed },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={clsx(styles.statValue, s.mod)}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            className={clsx(styles.filterBtn, f === activeFilter && styles.filterActive)}
            onClick={() => setActiveFilter(f)}
          >
            {f}
            {f !== 'All' && (
              <span className={styles.filterCount}>
                {executions.filter(e => e.status.toLowerCase() === (f as string).toLowerCase()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <circle cx="16" cy="16" r="13"/>
              <path d="M16 10v7l4 4"/>
            </svg>
          </div>
          <p className={styles.emptyTitle}>No executions yet</p>
          <p className={styles.emptySub}>Trigger a workflow run to see it here</p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Execution ID</span>
            <span>Status</span>
            <span>Trigger</span>
            <span>Started</span>
            <span>Duration</span>
            <span></span>
          </div>
          {filtered.map((ex, i) => {
            const dur = ex.startedAt && ex.completedAt
              ? Math.round(new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime())
              : null
            const isOpen = expandedId === ex.id
            return (
              <div key={ex.id} className={styles.rowGroup} style={{ animationDelay: `${i * 30}ms` }}>
                <div
                  className={clsx(styles.tableRow, isOpen && styles.tableRowOpen)}
                  onClick={() => handleRowClick(ex.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={styles.execId}>{ex.id.slice(0, 8)}…</span>
                  <StatusBadge status={ex.status} />
                  <span className={styles.trigger}>{(ex as any).triggeredBy ?? 'manual'}</span>
                  <span className={styles.timeText}>
                    {ex.startedAt
                      ? formatDistanceToNow(new Date(ex.startedAt), { addSuffix: true })
                      : '—'}
                  </span>
                  <span className={styles.durText}>{dur !== null ? `${dur}ms` : '—'}</span>
                  <span className={clsx(styles.chevron, isOpen && styles.chevronOpen)}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 4.5l3.5 3.5 3.5-3.5"/>
                    </svg>
                  </span>
                </div>

                {/* Step output drawer */}
                {isOpen && (
                  <div className={styles.drawer}>
                    {stepsLoading ? (
                      <div className={styles.drawerLoading}>
                        <span className={styles.drawerSpinner} />
                        Loading step details…
                      </div>
                    ) : stepsError ? (
                      <div className={styles.drawerError}>{stepsError}</div>
                    ) : steps.length === 0 ? (
                      <div className={styles.drawerEmpty}>No step records found for this execution.</div>
                    ) : (
                      <div className={styles.stepList}>
                        <div className={styles.stepListHeader}>
                          <span>Node ID</span>
                          <span>Status</span>
                          <span>Attempt</span>
                          <span>Duration</span>
                          <span>Output / Error</span>
                        </div>
                        {steps.map((step) => {
                          const stepDur = step.startedAt && step.completedAt
                            ? Math.round(new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime())
                            : null
                          return (
                            <StepRow key={step.id} step={step} dur={stepDur} />
                          )
                        })}
                      </div>
                    )}

                    {/* Trigger data */}
                    {!stepsLoading && !stepsError && ex.triggerData && (
                      <div className={styles.triggerData}>
                        <div className={styles.triggerDataLabel}>Trigger data</div>
                        <pre className={styles.jsonBlock}>
                          {JSON.stringify(ex.triggerData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Step row with expandable JSON output ──────────────────── */
function StepRow({ step, dur }: { step: StepExecution; dur: number | null }) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const hasOutput = step.output && Object.keys(step.output).length > 0

  return (
    <div className={styles.stepRow}>
      <div className={styles.stepRowMain}>
        <span className={styles.stepNodeId}>{step.nodeId.slice(0, 8)}…</span>
        <StepBadge status={step.status} />
        <span className={styles.stepAttempt}>#{step.attempt}</span>
        <span className={styles.stepDur}>{dur !== null ? `${dur}ms` : '—'}</span>
        <div className={styles.stepOutputCell}>
          {step.errorMessage ? (
            <span className={styles.stepError}>{step.errorMessage}</span>
          ) : hasOutput ? (
            <button className={styles.jsonToggle} onClick={() => setJsonOpen(v => !v)}>
              {jsonOpen ? 'Hide output' : 'View output'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d={jsonOpen ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} />
              </svg>
            </button>
          ) : (
            <span className={styles.stepNoOutput}>—</span>
          )}
        </div>
      </div>
      {jsonOpen && hasOutput && (
        <pre className={styles.jsonBlock}>
          {JSON.stringify(step.output, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ─── Badges ─────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: ExecutionStatus }) {
  const map: Record<ExecutionStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'pending' },
    queued:    { label: 'Queued',    cls: 'pending' },
    running:   { label: 'Running',   cls: 'running' },
    completed: { label: 'Completed', cls: 'completed' },
    failed:    { label: 'Failed',    cls: 'failed' },
    cancelled: { label: 'Cancelled', cls: 'cancelled' },
    timed_out: { label: 'Timed out', cls: 'failed' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'pending' }
  return (
    <span className={clsx(styles.badge, styles[`badge_${cls}`])}>
      <span className={clsx(styles.badgeDot, status === 'running' && styles.dotPulse)} />
      {label}
    </span>
  )
}

function StepBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'pending' },
    running:   { label: 'Running',   cls: 'running' },
    completed: { label: 'Completed', cls: 'completed' },
    failed:    { label: 'Failed',    cls: 'failed' },
    skipped:   { label: 'Skipped',   cls: 'cancelled' },
    retrying:  { label: 'Retrying',  cls: 'running' },
    timed_out: { label: 'Timed out', cls: 'failed' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'pending' }
  return (
    <span className={clsx(styles.stepBadge, styles[`badge_${cls}`])}>
      {label}
    </span>
  )
}
