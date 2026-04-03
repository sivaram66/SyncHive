import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkflows } from '@/hooks'
import { workflowsApi } from '@/lib/api'
import { useWorkflowStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import type { Workflow, WorkflowStatus, TriggerType } from '@/types'
import clsx from 'clsx'
import styles from './WorkflowsPage.module.css'

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: 'Draft', active: 'Active', paused: 'Paused', archived: 'Archived',
}

const TRIGGER_ICONS: Record<string, JSX.Element> = {
  webhook: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 1.5C4 1.5 2 3.5 2 6s2 4.5 4.5 4.5S11 8.5 11 6"/><path d="M9 1.5l1.5 1.5L9 4.5"/>
    </svg>
  ),
  schedule: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2" width="10" height="9.5" rx="1.5"/><path d="M1.5 5.5h10M4.5 1v2M8.5 1v2"/>
    </svg>
  ),
  manual: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 2v5M4 4.5L6.5 2 9 4.5M3 9h7a1 1 0 010 2H3a1 1 0 010-2z"/>
    </svg>
  ),
  event: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 1.5L2 7.5h5L4.5 11.5l6.5-6.5H6L7.5 1.5z"/>
    </svg>
  ),
}

export function WorkflowsPage() {
  const { workflows, loading, error, refetch } = useWorkflows()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const activeCount   = workflows.filter(w => w.status === 'active').length
  const draftCount    = workflows.filter(w => w.status === 'draft').length

  if (loading) return <LoadingState />
  if (error)   return <ErrorState message={error} />

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Workflows</h1>
          <p className={styles.sub}>{workflows.length} workflow{workflows.length !== 1 ? 's' : ''} in this workspace</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 2v10M2 7h10"/>
          </svg>
          New Workflow
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="5" height="5" rx="1.2"/><rect x="8" y="1" width="5" height="5" rx="1.2"/>
              <rect x="4.5" y="8" width="5" height="5" rx="1.2"/>
              <path d="M3.5 6v1.2a2 2 0 002 2H6.5M10.5 6v1.2a2 2 0 01-2 2H7.5"/>
            </svg>
          </div>
          <div>
            <div className={styles.statVal}>{workflows.length}</div>
            <div className={styles.statLabel}>Total workflows</div>
          </div>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statCard}>
          <div className={clsx(styles.statIcon, styles.statIconGreen)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5.5"/><path d="M4.5 7l2 2 3-3"/>
            </svg>
          </div>
          <div>
            <div className={clsx(styles.statVal, styles.statValGreen)}>{activeCount}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1.5v4l2.5 2.5"/><circle cx="7" cy="8" r="5.5"/>
            </svg>
          </div>
          <div>
            <div className={styles.statVal}>{draftCount}</div>
            <div className={styles.statLabel}>Drafts</div>
          </div>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statCard}>
          <div className={clsx(styles.statIcon, styles.statIconRed)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7l2 4 4-7"/>
            </svg>
          </div>
          <div>
            <div className={styles.statVal}>—</div>
            <div className={styles.statLabel}>Runs today</div>
          </div>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10.5l2.5-2.5 2 2 3-3 2.5 2.5"/><path d="M1.5 3.5h11v8a1 1 0 01-1 1h-9a1 1 0 01-1-1v-8z"/>
            </svg>
          </div>
          <div>
            <div className={styles.statVal}>—</div>
            <div className={styles.statLabel}>Success rate</div>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      {workflows.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreate(true)} />
      ) : (
        <div className={styles.grid}>
          {workflows.map((wf, i) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              index={i}
              onClick={() => navigate(`/workflows/${wf.id}`)}
              onRefetch={refetch}
            />
          ))}
          {/* Quick start card */}
          <div className={styles.addCard} onClick={() => setShowCreate(true)}>
            <div className={styles.addCardIcon}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M10 4v12M4 10h12"/>
              </svg>
            </div>
            <div className={styles.addCardLabel}>New workflow</div>
            <div className={styles.addCardSub}>Click to create</div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateWorkflowModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => navigate(`/workflows/${id}`)}
        />
      )}
    </div>
  )
}

/* ── Workflow Card ── */
function WorkflowCard({ workflow, index, onClick, onRefetch }: {
  workflow: Workflow
  index: number
  onClick: () => void
  onRefetch: () => void
}) {
  const [activating, setActivating] = useState(false)
  const [executing, setExecuting]   = useState(false)
  const { updateWorkflow }          = useWorkflowStore()

  async function handleActivate(e: React.MouseEvent) {
    e.stopPropagation()
    setActivating(true)
    try {
      const res = await workflowsApi.activate(workflow.id)
      if (res.success && res.data) updateWorkflow(workflow.id, { status: res.data.status })
    } finally { setActivating(false) }
  }

  async function handleExecute(e: React.MouseEvent) {
    e.stopPropagation()
    setExecuting(true)
    try { await workflowsApi.execute(workflow.id); onRefetch() }
    finally { setExecuting(false) }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${workflow.name}"?`)) return
    await workflowsApi.delete(workflow.id)
    onRefetch()
  }

  return (
    <div
      className={clsx(styles.card, workflow.status === 'active' && styles.cardActive)}
      onClick={onClick}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {/* Top gradient line for active */}
      {workflow.status === 'active' && <div className={styles.cardGlowLine} />}

      {/* Card header */}
      <div className={styles.cardHeader}>
        <div className={clsx(styles.cardIconWrap, workflow.status === 'active' && styles.cardIconActive)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="5" height="5" rx="1.5"/><rect x="10" y="1" width="5" height="5" rx="1.5"/>
            <rect x="5.5" y="10" width="5" height="5" rx="1.5"/>
            <path d="M3.5 6v2a2 2 0 002 2H7M12.5 6v2a2 2 0 01-2 2H9"/>
          </svg>
        </div>
        <span className={clsx(styles.statusBadge, styles[`status_${workflow.status}`])}>
          {workflow.status === 'active' && <span className={styles.statusPulse} />}
          {STATUS_LABELS[workflow.status]}
        </span>
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{workflow.name}</h3>
        <p className={styles.cardDesc}>{workflow.description ?? `Triggered by ${workflow.triggerType}`}</p>
      </div>

      {/* Trigger + time */}
      <div className={styles.cardMeta}>
        <span className={styles.triggerChip}>
          <span className={styles.triggerIcon}>{TRIGGER_ICONS[workflow.triggerType] ?? TRIGGER_ICONS.manual}</span>
          {workflow.triggerType}
        </span>
        <span className={styles.metaTime}>
          {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}
        </span>
      </div>

      {/* Actions */}
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        {workflow.status === 'draft' && (
          <button className={clsx(styles.actionBtn, styles.activateBtn)} onClick={handleActivate} disabled={activating}>
            {activating ? <MiniSpinner /> : 'Activate'}
          </button>
        )}
        {workflow.status === 'active' && (
          <button className={clsx(styles.actionBtn, styles.runBtn)} onClick={handleExecute} disabled={executing}>
            {executing ? <MiniSpinner /> : <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5l7 3.5-7 3.5V1.5z"/></svg>
              Run
            </>}
          </button>
        )}
        <button className={clsx(styles.actionBtn, styles.editBtn)} onClick={(e) => { e.stopPropagation(); onClick() }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 1.5a1.5 1.5 0 012.1 2.1L4 10.2l-3 .8.8-3 6.7-6.5z"/>
          </svg>
          Edit
        </button>
        <button className={clsx(styles.actionBtn, styles.deleteBtn)} onClick={handleDelete}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h8M4.5 3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5 5.5v3M7 5.5v3M3.5 3l.5 7a1 1 0 001 1h3a1 1 0 001-1l.5-7"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Create Modal ── */
function CreateWorkflowModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<TriggerType>('webhook')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const { setWorkflows, workflows }    = useWorkflowStore()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await workflowsApi.create({ name: name.trim(), description, triggerType })
      if (res.success && res.data) {
        setWorkflows([res.data, ...workflows])
        onCreated(res.data.id)
      } else { setError(res.error ?? 'Failed to create workflow') }
    } catch { setError('Failed to create workflow') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTop} />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New workflow</h2>
          <button className={styles.modalClose} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
          </button>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Workflow name</label>
            <input className={styles.fieldInput} type="text" placeholder="e.g. github-star-handler"
              value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Description <span className={styles.optional}>(optional)</span></label>
            <input className={styles.fieldInput} type="text" placeholder="What does this workflow do?"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Trigger type</label>
            <select className={styles.fieldInput} value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}>
              <option value="webhook">Webhook</option>
              <option value="schedule">Schedule</option>
              <option value="manual">Manual</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !name.trim()}>
              {loading ? <MiniSpinner light /> : 'Create workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className={styles.centered}>
      <div className={styles.loadingSpinner} />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return <div className={styles.centered}><p className={styles.errorText}>{message}</p></div>
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIconWrap}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="10" height="10" rx="2.5"/><rect x="16" y="2" width="10" height="10" rx="2.5"/>
          <rect x="9" y="16" width="10" height="10" rx="2.5"/>
          <path d="M7 12v2a4 4 0 004 4h1M21 12v2a4 4 0 01-4 4h-1"/>
        </svg>
      </div>
      <h2 className={styles.emptyTitle}>No workflows yet</h2>
      <p className={styles.emptySub}>Create your first workflow to start automating</p>
      <button className={styles.createBtn} onClick={onCreateClick}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
        New Workflow
      </button>
    </div>
  )
}

function MiniSpinner({ light }: { light?: boolean }) {
  return (
    <span style={{
      width: 13, height: 13, borderRadius: '50%', display: 'inline-block',
      border: `2px solid ${light ? 'rgba(255,255,255,0.3)' : 'var(--gb2)'}`,
      borderTopColor: light ? '#fff' : 'var(--t2)',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}