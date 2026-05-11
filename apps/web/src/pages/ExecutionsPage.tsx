import { useState } from 'react'
import { useWorkflowStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import type { ExecutionStatus } from '@/types'
import styles from './ExecutionsPage.module.css'

const STATUS_FILTERS = ['All', 'Running', 'Completed', 'Failed'] as const
type Filter = typeof STATUS_FILTERS[number]

export function ExecutionsPage() {
  const { executions } = useWorkflowStore()
  const [activeFilter, setActiveFilter] = useState<Filter>('All')

  const filtered = executions.filter((ex) => {
    if (activeFilter === 'All') return true
    return ex.status.toLowerCase() === activeFilter.toLowerCase()
  })

  const stats = {
    total: executions.length,
    running: executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length,
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Executions</h1>
          <p className={styles.sub}>Real-time view of all workflow runs</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total Runs</span>
        </div>
        <div className={styles.statCard}>
          <span className={clsx(styles.statValue, styles.valueRunning)}>{stats.running}</span>
          <span className={styles.statLabel}>Running</span>
        </div>
        <div className={styles.statCard}>
          <span className={clsx(styles.statValue, styles.valueGreen)}>{stats.completed}</span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        <div className={styles.statCard}>
          <span className={clsx(styles.statValue, styles.valueFailed)}>{stats.failed}</span>
          <span className={styles.statLabel}>Failed</span>
        </div>
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
                {executions.filter(e =>
                  e.status.toLowerCase() === (f as string).toLowerCase()
                ).length}
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
          </div>
          {filtered.map((ex, i) => {
            const dur = ex.startedAt && ex.completedAt
              ? Math.round(new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime())
              : null
            return (
              <div key={ex.id} className={styles.tableRow} style={{ animationDelay: `${i * 30}ms` }}>
                <span className={styles.execId}>{ex.id.slice(0, 8)}…</span>
                <StatusBadge status={ex.status} />
                <span className={styles.trigger}>{(ex as any).triggeredBy ?? 'manual'}</span>
                <span className={styles.timeText}>
                  {ex.startedAt
                    ? formatDistanceToNow(new Date(ex.startedAt), { addSuffix: true })
                    : '—'}
                </span>
                <span className={styles.durText}>{dur !== null ? `${dur}ms` : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
