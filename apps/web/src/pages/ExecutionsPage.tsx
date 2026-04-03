import { useWorkflowStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import type { ExecutionStatus } from '@/types'
import styles from './ExecutionsPage.module.css'

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  pending:   'rgba(200,200,200,0.5)',
  queued:    'rgba(200,200,200,0.6)',
  running:   'rgba(240,240,248,0.9)',
  completed: 'rgba(80,200,140,0.9)',
  failed:    'rgba(220,80,80,0.85)',
  cancelled: 'rgba(200,160,60,0.7)',
  timed_out: 'rgba(220,80,80,0.7)',
}

export function ExecutionsPage() {
  const { executions } = useWorkflowStore()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Executions</h1>
        <p className={styles.sub}>{executions.length} execution{executions.length !== 1 ? 's' : ''} recorded</p>
      </div>

      {executions.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No executions yet</p>
          <p className={styles.emptySub}>Run a workflow to see execution history here</p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Execution ID</span>
            <span>Status</span>
            <span>Workflow</span>
            <span>Started</span>
            <span>Duration</span>
          </div>
          {executions.map((ex, i) => {
            const dur = ex.startedAt && ex.completedAt
              ? Math.round(new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime())
              : null
            return (
              <div
                key={ex.id}
                className={styles.tableRow}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className={styles.execId}>{ex.id.slice(0, 12)}…</span>
                <span className={styles.statusCell}>
                  <span
                    className={styles.statusDot}
                    style={{ background: STATUS_COLORS[ex.status],
                      boxShadow: ex.status === 'running' ? `0 0 8px ${STATUS_COLORS[ex.status]}` : 'none' }}
                  />
                  <span className={clsx(styles.statusText, styles[`status_${ex.status}`])}>
                    {ex.status}
                  </span>
                </span>
                <span className={styles.wfId}>{ex.workflowId.slice(0, 8)}…</span>
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
