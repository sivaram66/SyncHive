import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkflow, useExecutions } from '@/hooks'
import { workflowsApi, nodesApi } from '@/lib/api'
import { useWorkflowStore } from '@/lib/store'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import type { NodeType, WorkflowExecution, ExecutionStatus } from '@/types'
import styles from './EditorPage.module.css'

const STATUS_COLOR: Record<ExecutionStatus, string> = {
  pending:    'rgba(240,240,240,0.4)',
  queued:     'rgba(240,240,240,0.5)',
  running:    'rgba(240,240,240,0.9)',
  completed:  'rgba(80,200,140,0.9)',
  failed:     'rgba(220,80,80,0.85)',
  cancelled:  'rgba(200,160,60,0.7)',
  timed_out:  'rgba(220,80,80,0.7)',
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workflow, loading, error, refetch } = useWorkflow(id)
  const { executions, refetch: refetchExec }  = useExecutions(id)
  const { updateWorkflow }                    = useWorkflowStore()

  const [activating,  setActivating]  = useState(false)
  const [executing,   setExecuting]   = useState(false)
  const [showAddNode, setShowAddNode] = useState(false)
  const [panelOpen,   setPanelOpen]   = useState(true)

  async function handleActivate() {
    if (!workflow) return
    setActivating(true)
    try {
      const res = await workflowsApi.activate(workflow.id)
      if (res.success && res.data) updateWorkflow(workflow.id, { status: res.data.status })
    } finally {
      setActivating(false)
    }
  }

  async function handleExecute() {
    if (!workflow) return
    setExecuting(true)
    try {
      await workflowsApi.execute(workflow.id)
      refetchExec()
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorText}>{error ?? 'Workflow not found'}</p>
        <button className={styles.backBtn} onClick={() => navigate('/workflows')}>
          ← Back to workflows
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ── Editor topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.topLeft}>
          <button className={styles.backLink} onClick={() => navigate('/workflows')}>
            <ChevronIcon /> Workflows
          </button>
          <span className={styles.sep}>/</span>
          <span className={styles.wfName}>{workflow.name}</span>
          <span className={clsx(styles.statusChip, styles[`chip_${workflow.status}`])}>
            <span className={styles.chipDot} />
            {workflow.status}
          </span>
        </div>

        <div className={styles.topRight}>
          <button className={styles.iconBtn} onClick={() => setShowAddNode(true)} title="Add node">
            <PlusIcon />
          </button>
          <button className={styles.iconBtn} onClick={() => setPanelOpen((p) => !p)} title="Toggle executions">
            <PanelIcon />
          </button>

          {workflow.status === 'draft' && (
            <button
              className={clsx(styles.btn, styles.activateBtn)}
              onClick={handleActivate}
              disabled={activating}
            >
              {activating ? <MiniSpinner /> : 'Activate'}
            </button>
          )}

          {workflow.status === 'active' && (
            <button
              className={clsx(styles.btn, styles.runBtn)}
              onClick={handleExecute}
              disabled={executing}
            >
              {executing ? <MiniSpinner /> : '▶ Run now'}
            </button>
          )}

          <button className={clsx(styles.btn, styles.primaryBtn)} onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Main area: Canvas + Executions panel ── */}
      <div className={styles.body}>
        <WorkflowCanvas workflow={workflow} onRefetch={refetch} />

        {panelOpen && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Recent executions</span>
              <button
                className={styles.panelRefresh}
                onClick={refetchExec}
                title="Refresh"
              >
                <RefreshIcon />
              </button>
            </div>

            {executions.length === 0 ? (
              <div className={styles.panelEmpty}>
                <p className={styles.panelEmptyText}>No executions yet</p>
                <p className={styles.panelEmptySub}>Run the workflow to see results here</p>
              </div>
            ) : (
              <div className={styles.executionList}>
                {executions.map((ex) => (
                  <ExecutionRow key={ex.id} execution={ex} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Node modal ── */}
      {showAddNode && (
        <AddNodeModal
          workflowId={workflow.id}
          onClose={() => setShowAddNode(false)}
          onAdded={refetch}
        />
      )}
    </div>
  )
}

/* ── Execution Row ── */
function ExecutionRow({ execution }: { execution: WorkflowExecution }) {
  const dot = STATUS_COLOR[execution.status]
  const dur = execution.startedAt && execution.completedAt
    ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()))
    : null

  return (
    <div className={styles.execRow}>
      <div className={styles.execDot} style={{ background: dot,
        boxShadow: execution.status === 'running' ? `0 0 8px ${dot}` : 'none' }} />
      <div className={styles.execInfo}>
        <div className={styles.execId}>{execution.id.slice(0, 8)}…</div>
        <div className={styles.execTime}>
          {formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}
        </div>
      </div>
      <div className={styles.execRight}>
        {dur !== null && (
          <span className={styles.execDur}>{dur}ms</span>
        )}
        <span className={clsx(styles.execStatus, styles[`execStatus_${execution.status}`])}>
          {execution.status}
        </span>
      </div>
    </div>
  )
}

/* ── Add Node Modal ── */
const NODE_TYPES: { type: NodeType; label: string; desc: string }[] = [
  { type: 'trigger',     label: 'Trigger',     desc: 'Webhook or schedule start' },
  { type: 'action',      label: 'Action',      desc: 'HTTP, email, Slack, etc.' },
  { type: 'condition',   label: 'Condition',   desc: 'Branch on expression result' },
  { type: 'ai',          label: 'AI Node',     desc: 'LLM call with prompt' },
  { type: 'transformer', label: 'Transformer', desc: 'Pick, merge, rename fields' },
  { type: 'loop',        label: 'Loop',        desc: 'Iterate over an array' },
]

function AddNodeModal({ workflowId, onClose, onAdded }: {
  workflowId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [name, setName]       = useState('')
  const [type, setType]       = useState<NodeType>('action')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await nodesApi.create(workflowId, {
        name: name.trim(),
        type,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 80 },
        retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
        timeoutMs: 30000,
      })
      if (res.success) {
        onAdded()
        onClose()
      } else {
        setError(res.error ?? 'Failed to add node')
      }
    } catch {
      setError('Failed to add node')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add node</h2>
          <button className={styles.modalClose} onClick={onClose}><CloseIcon /></button>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Node name</label>
          <input
            className={styles.fieldInput}
            type="text"
            placeholder="e.g. Send Slack message"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Node type</label>
          <div className={styles.typeGrid}>
            {NODE_TYPES.map((nt) => (
              <button
                key={nt.type}
                className={clsx(styles.typeCard, type === nt.type && styles.typeCardActive)}
                onClick={() => setType(nt.type)}
              >
                <span className={styles.typeLabel}>{nt.label}</span>
                <span className={styles.typeDesc}>{nt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.submitBtn}
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? <MiniSpinner /> : 'Add node'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function ChevronIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4" /></svg>
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
}

function PanelIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1.5" y="1.5" width="11" height="11" rx="2" /><path d="M9.5 1.5v11" /></svg>
}

function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6.5A4.5 4.5 0 112 6.5M11 2.5V6.5H7" /></svg>
}

function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
}

function MiniSpinner() {
  return <span className={styles.miniSpinner} />
}
