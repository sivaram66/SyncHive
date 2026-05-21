import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { executionsApi } from '@/lib/api'
import type { WorkflowExecution, StepExecution } from '@/types'
import clsx from 'clsx'
import styles from './LogsPage.module.css'

const STATUS_COLOR: Record<string, string> = {
  completed: styles.logGreen,
  failed:    styles.logRed,
  running:   styles.logBlue,
  skipped:   styles.logGray,
  retrying:  styles.logAmber,
  timed_out: styles.logRed,
  cancelled: styles.logGray,
  pending:   styles.logGray,
  queued:    styles.logGray,
}

const STEP_STATUS_ICON: Record<string, string> = {
  completed: '✓',
  failed:    '✗',
  running:   '▶',
  skipped:   '⊘',
  retrying:  '↺',
  timed_out: '⏱',
  pending:   '○',
}

export function LogsPage() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expanded,   setExpanded]   = useState<Record<string, StepExecution[]>>({})
  const [loadingId,  setLoadingId]  = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    executionsApi.list(1, 100)
      .then(res => { if (res.success && res.data) setExecutions(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded[id]) {
      setExpanded(prev => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    setLoadingId(id)
    try {
      const res = await executionsApi.steps(id)
      if (res.success && res.data) {
        setExpanded(prev => ({ ...prev, [id]: res.data! }))
      }
    } catch {} finally { setLoadingId(null) }
  }, [expanded])

  const filtered = executions.filter(ex => {
    const matchStatus = statusFilter === 'all' || ex.status === statusFilter
    const matchSearch = !search.trim() ||
      ex.id.toLowerCase().includes(search.toLowerCase()) ||
      (ex as any).triggeredBy?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Logs</h1>
          <p className={styles.sub}>Detailed execution history — click any entry to expand step timeline</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5l3 3"/>
          </svg>
          <input
            className={styles.search}
            placeholder="Search by ID or trigger…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          {['all', 'completed', 'failed', 'running', 'queued'].map(s => (
            <button
              key={s}
              className={clsx(styles.filterBtn, statusFilter === s && styles.filterActive)}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.center}><span className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <rect x="3" y="3" width="22" height="22" rx="3"/>
            <path d="M8 10h12M8 14h8M8 18h5"/>
          </svg>
          <p>No executions match your filters</p>
        </div>
      ) : (
        <div className={styles.logList}>
          {filtered.map((ex, i) => {
            const isOpen = !!expanded[ex.id]
            const steps  = expanded[ex.id]
            const dur    = ex.startedAt && ex.completedAt
              ? Math.round(new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime())
              : null

            return (
              <div key={ex.id} className={styles.entry} style={{ animationDelay: `${i * 25}ms` }}>
                {/* ─ Entry header ─ */}
                <div className={styles.entryHead} onClick={() => toggleExpand(ex.id)}>
                  <div className={clsx(styles.entryStatus, STATUS_COLOR[ex.status] ?? styles.logGray)} />
                  <div className={styles.entryMeta}>
                    <span className={styles.entryId}><span className={styles.idPrefix}>exec_</span>{ex.id.slice(0, 12)}…</span>
                    <span className={clsx(styles.badge, STATUS_COLOR[ex.status] ?? styles.logGray)}>
                      {ex.status}
                    </span>
                    <span className={styles.entryTrigger}>{(ex as any).triggeredBy ?? 'manual'}</span>
                  </div>
                  <div className={styles.entryTimes}>
                    {dur != null && <span className={styles.durBadge}>{dur}ms</span>}
                    <span className={styles.timeText}>
                      {ex.startedAt
                        ? formatDistanceToNow(new Date(ex.startedAt), { addSuffix: true })
                        : '—'}
                    </span>
                  </div>
                  <svg
                    className={clsx(styles.chevron, isOpen && styles.chevronOpen)}
                    width="12" height="12" viewBox="0 0 12 12"
                    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  >
                    <path d="M2.5 4.5l3.5 3.5 3.5-3.5"/>
                  </svg>
                </div>

                {/* ─ Step timeline ─ */}
                {isOpen && (
                  <div className={styles.timeline}>
                    {loadingId === ex.id ? (
                      <div className={styles.timelineLoading}><span className={styles.spinner} /> Loading steps…</div>
                    ) : !steps || steps.length === 0 ? (
                      <div className={styles.timelineEmpty}>No step records for this execution</div>
                    ) : (
                      <>
                        <div className={styles.timelineHeader}>
                          <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
                          <span>
                            {ex.startedAt && format(new Date(ex.startedAt), 'PPpp')}
                          </span>
                        </div>
                        <div className={styles.steps}>
                          {steps.map((step, si) => {
                            const stepDur = step.startedAt && step.completedAt
                              ? Math.round(new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime())
                              : null
                            return (
                              <StepEntry key={step.id} step={step} dur={stepDur} index={si} total={steps.length} />
                            )
                          })}
                        </div>
                        {/* Trigger data */}
                        {ex.triggerData && (
                          <details className={styles.triggerDetails}>
                            <summary className={styles.triggerSummary}>Trigger payload</summary>
                            <pre className={styles.json}>{JSON.stringify(ex.triggerData, null, 2)}</pre>
                          </details>
                        )}
                      </>
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

function StepEntry({ step, dur, index, total }: { step: StepExecution; dur: number | null; index: number; total: number }) {
  const [showJson, setShowJson] = useState(false)
  const icon  = STEP_STATUS_ICON[step.status] ?? '○'
  const color = STATUS_COLOR[step.status] ?? styles.logGray
  const hasOutput = step.output && Object.keys(step.output).length > 0

  return (
    <div className={styles.step}>
      <div className={styles.stepLine}>
        <div className={clsx(styles.stepDot, color)}>{icon}</div>
        {index < total - 1 && <div className={styles.stepConnector} />}
      </div>
      <div className={styles.stepBody}>
        <div className={styles.stepRow}>
          <span className={styles.stepNodeId}><span className={styles.idPrefix}>node_</span>{step.nodeId.slice(0, 10)}…</span>
          <span className={clsx(styles.stepBadge, color)}>{step.status}</span>
          <span className={styles.stepAttempt}>#{step.attempt}</span>
          {dur != null && <span className={styles.stepDur}>{dur}ms</span>}
        </div>
        {step.errorMessage && (
          <div className={styles.stepError}>{step.errorMessage}</div>
        )}
        {hasOutput && (
          <button className={styles.jsonToggle} onClick={() => setShowJson(v => !v)}>
            {showJson ? '▾ Hide output' : '▸ View output'}
          </button>
        )}
        {showJson && hasOutput && (
          <pre className={styles.json}>{JSON.stringify(step.output, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
