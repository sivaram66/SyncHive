import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import api from '@/lib/api'
import styles from './SchedulerPage.module.css'

interface ScheduleItem {
  workflowId: string
  name: string
  description: string | null
  status: string
  cronExpression: string | null
  timezone: string
  nextRun: string | null
  prevRun: string | null
  cronDescription: string | null
  updatedAt: string
}

export function SchedulerPage() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    api.get('/scheduler/schedules')
      .then(res => {
        if (res.data?.success) setSchedules(res.data.data)
        else setError(res.data?.message ?? 'Failed to load schedules')
      })
      .catch(() => setError('Failed to load schedules'))
      .finally(() => setLoading(false))
  }, [])

  const active  = schedules.filter(s => s.status === 'active')
  const paused  = schedules.filter(s => s.status === 'paused')
  const draft   = schedules.filter(s => s.status === 'draft')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scheduler</h1>
          <p className={styles.sub}>All cron-triggered workflows in this workspace</p>
        </div>
        <button className={styles.newBtn} onClick={() => navigate('/workflows')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6.5 1v11M1 6.5h11"/>
          </svg>
          New Schedule
        </button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        {[
          { label: 'Total schedules', value: schedules.length, color: '' },
          { label: 'Active',          value: active.length,    color: styles.green },
          { label: 'Paused',          value: paused.length,    color: styles.amber },
          { label: 'Draft',           value: draft.length,     color: '' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={`${styles.statNum} ${s.color}`}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className={styles.center}><span className={styles.spinner} /></div>
      ) : error ? (
        <div className={styles.errorBox}>{error}</div>
      ) : schedules.length === 0 ? (
        <EmptyState onNew={() => navigate('/workflows')} />
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Workflow</span>
            <span>Cron expression</span>
            <span>Status</span>
            <span>Previous run</span>
            <span>Next run</span>
            <span></span>
          </div>

          {schedules.map((s, i) => (
            <div
              key={s.workflowId}
              className={styles.row}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <div className={styles.rowName}>
                <div className={styles.nameText}>{s.name}</div>
                {s.description && <div className={styles.nameDesc}>{s.description}</div>}
                <div className={styles.timezone}>⏱ {s.timezone}</div>
              </div>

              <div className={styles.cron}>
                <code className={styles.cronCode}>{s.cronExpression ?? '—'}</code>
              </div>

              <StatusChip status={s.status} />

              <div className={styles.time}>
                {s.prevRun
                  ? <span title={format(new Date(s.prevRun), 'PPpp')}>
                      {formatDistanceToNow(new Date(s.prevRun), { addSuffix: true })}
                    </span>
                  : <span className={styles.dimText}>Never</span>}
              </div>

              <div className={styles.nextRun}>
                {s.nextRun && s.status === 'active'
                  ? <>
                      <span className={styles.nextBadge}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                          <circle cx="5" cy="5" r="4"/><path d="M5 3v2l1.5 1.5"/>
                        </svg>
                        {formatDistanceToNow(new Date(s.nextRun), { addSuffix: true })}
                      </span>
                      <div className={styles.nextAbsolute}>{format(new Date(s.nextRun), 'HH:mm · d MMM')}</div>
                    </>
                  : <span className={styles.dimText}>{s.status === 'paused' ? 'Paused' : '—'}</span>}
              </div>

              <button
                className={styles.editBtn}
                onClick={() => navigate(`/workflows/${s.workflowId}`)}
                title="Open in editor"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 1.5a1.5 1.5 0 012.1 2.1L4.5 11.2l-3 .8.8-3L9 1.5z"/>
                </svg>
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cron cheatsheet */}
      <CronCheatsheet />
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Active',   cls: styles.chipActive  },
    paused:   { label: 'Paused',   cls: styles.chipPaused  },
    draft:    { label: 'Draft',    cls: styles.chipDraft   },
    archived: { label: 'Archived', cls: styles.chipDraft   },
  }
  const { label, cls } = map[status] ?? { label: status, cls: styles.chipDraft }
  return (
    <span className={`${styles.chip} ${cls}`}>
      {status === 'active' && <span className={styles.chipPulse} />}
      {label}
    </span>
  )
}

function CronCheatsheet() {
  const examples = [
    { expr: '* * * * *',       desc: 'Every minute'               },
    { expr: '0 * * * *',       desc: 'Every hour'                 },
    { expr: '0 9 * * *',       desc: 'Every day at 9am'           },
    { expr: '0 9 * * 1-5',     desc: 'Weekdays at 9am'            },
    { expr: '0 0 * * 0',       desc: 'Every Sunday midnight'      },
    { expr: '0 */6 * * *',     desc: 'Every 6 hours'              },
    { expr: '30 8 1 * *',      desc: '1st of each month at 8:30am'},
    { expr: '0 0 1 1 *',       desc: 'New Year\'s Day midnight'   },
  ]

  return (
    <div className={styles.cheatsheet}>
      <div className={styles.cheatTitle}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="5.5"/><path d="M7 4.5v3l2 2"/>
        </svg>
        Cron expression quick reference
      </div>
      <div className={styles.cheatFormat}>
        <code>MIN &nbsp;HOUR &nbsp;DOM &nbsp;MON &nbsp;DOW</code>
        <span className={styles.cheatFormatSub}>Minute · Hour · Day of month · Month · Day of week</span>
      </div>
      <div className={styles.cheatGrid}>
        {examples.map(ex => (
          <div key={ex.expr} className={styles.cheatRow}>
            <code className={styles.cheatCode}>{ex.expr}</code>
            <span className={styles.cheatDesc}>{ex.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="16" cy="16" r="13"/><path d="M16 9v7l4 4"/>
        </svg>
      </div>
      <h2 className={styles.emptyTitle}>No scheduled workflows</h2>
      <p className={styles.emptySub}>Create a workflow with a Schedule trigger to see it here</p>
      <button className={styles.newBtn} onClick={onNew}>Create workflow</button>
    </div>
  )
}
