import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkflow, useExecutions, useSSE } from '@/hooks'
import { workflowsApi, nodesApi } from '@/lib/api'
import { useWorkflowStore, useExecutionLiveStore } from '@/lib/store'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { NodeConfigPanel } from '@/components/workflow/NodeConfigPanel'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import type { NodeType, WorkflowNode, WorkflowExecution, ExecutionStatus } from '@/types'
import styles from './EditorPage.module.css'

const STATUS_COLOR: Record<ExecutionStatus, string> = {
  pending:   'rgba(255,255,255,0.3)',
  queued:    'rgba(255,255,255,0.4)',
  running:   'rgba(255,255,255,0.9)',
  completed: 'rgba(80,200,140,0.9)',
  failed:    'rgba(232,57,42,0.85)',
  cancelled: 'rgba(200,160,60,0.7)',
  timed_out: 'rgba(232,57,42,0.7)',
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workflow, loading, error, refetch } = useWorkflow(id)
  const { executions, refetch: refetchExec }  = useExecutions(id)
  const { updateWorkflow }                    = useWorkflowStore()
  const { activeExecutionId, nodeStatuses, setActiveExecution, reset } = useExecutionLiveStore()

  const [activating,    setActivating]    = useState(false)
  const [pausing,       setPausing]       = useState(false)
  const [executing,     setExecuting]     = useState(false)
  const [showAddNode,   setShowAddNode]   = useState(false)
  const [panelOpen,     setPanelOpen]     = useState(true)
  const [selectedNode,  setSelectedNode]  = useState<WorkflowNode | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const handleNodeSelect = useCallback((node: WorkflowNode | null) => {
    setSelectedNode(node)
    if (node) setPanelOpen(true)
  }, [])

  // Wire SSE — subscribes to the active execution's stream
  useSSE(activeExecutionId)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleActivate() {
    if (!workflow) return
    setActivating(true)
    try {
      const res = await workflowsApi.activate(workflow.id)
      if (res.success && res.data) {
        updateWorkflow(workflow.id, { status: res.data.status })
        const ver = (res.data as any).currentVersion
        showToast(`✅ Snapshot updated${ver ? ` — version ${ver}` : ''}. New executions use the latest config.`)
      } else {
        showToast(`Cannot activate: ${res.error ?? 'Unknown error'}`, 'error')
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (err as any)?.response?.data
      const msg =
        typeof d?.error   === 'string' ? d.error :
        typeof d?.message === 'string' ? d.message :
        typeof (err as any)?.message === 'string' ? (err as any).message :
        'Failed to activate workflow'
      showToast(`Cannot activate: ${msg}`, 'error')
    } finally {
      setActivating(false)
    }
  }

  async function handlePause() {
    if (!workflow) return
    setPausing(true)
    try {
      const res = await workflowsApi.pause(workflow.id)
      if (res.success) {
        updateWorkflow(workflow.id, { status: 'paused' })
        showToast('⏸ Workflow paused — webhooks and schedules will not trigger.')
      } else {
        showToast(`Failed to pause: ${res.error ?? 'Unknown error'}`, 'error')
      }
    } catch {
      showToast('Failed to pause workflow', 'error')
    } finally {
      setPausing(false)
    }
  }

  async function handleDeactivate() {
    if (!workflow) return
    setPausing(true)
    try {
      const res = await workflowsApi.deactivate(workflow.id)
      if (res.success) {
        updateWorkflow(workflow.id, { status: 'draft' })
        showToast('🔴 Workflow deactivated — returned to draft.')
      } else {
        showToast(`Failed to deactivate: ${res.error ?? 'Unknown error'}`, 'error')
      }
    } catch {
      showToast('Failed to deactivate workflow', 'error')
    } finally {
      setPausing(false)
    }
  }

  async function handleExecute() {
    if (!workflow) return
    setExecuting(true)
    reset() // clear previous execution status from nodes
    try {
      const res = await workflowsApi.execute(workflow.id)
      if (res.success && res.data) {
        // Start watching this execution via SSE
        setActiveExecution(res.data.executionId)
        refetchExec()
      }
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

  const liveExecution = activeExecutionId
    ? executions.find(e => e.id === activeExecutionId)
    : null

  return (
    <div className={styles.page}>
      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '10px 20px', borderRadius: 8, maxWidth: 480,
          background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: '#fff', fontWeight: 600, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'none', whiteSpace: 'nowrap'
        }}>
          {toast.msg}
        </div>
      )}
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

          {/* Live execution indicator */}
          {activeExecutionId && liveExecution?.status === 'running' && (
            <span className={styles.liveChip}>
              <span className={styles.liveDot} />
              Running
            </span>
          )}
          {activeExecutionId && liveExecution?.status === 'completed' && (
            <span className={clsx(styles.liveChip, styles.liveChipDone)}>
              ✓ Completed
            </span>
          )}
          {activeExecutionId && liveExecution?.status === 'failed' && (
            <span className={clsx(styles.liveChip, styles.liveChipFail)}>
              ✗ Failed
            </span>
          )}
        </div>

        <div className={styles.topRight}>
          <button className={styles.iconBtn} onClick={() => setShowAddNode(true)} title="Add node">
            <PlusIcon />
          </button>
          <button className={styles.iconBtn} onClick={() => setPanelOpen(p => !p)} title="Toggle panel">
            <PanelIcon />
          </button>
          {activeExecutionId && (
            <button className={clsx(styles.btn, styles.clearBtn)} onClick={reset} title="Clear execution state">
              Clear
            </button>
          )}
          {workflow.status === 'draft' && (
            <button className={clsx(styles.btn, styles.activateBtn)} onClick={handleActivate} disabled={activating}>
              {activating ? <MiniSpinner /> : 'Activate'}
            </button>
          )}
          {workflow.status === 'active' && (
            <button className={clsx(styles.btn, styles.activateBtn)} onClick={handleActivate} disabled={activating} title="Re-freeze snapshot with latest node configs">
              {activating ? <MiniSpinner /> : '↻ Re-activate'}
            </button>
          )}
          {workflow.status === 'active' && (
            <button className={clsx(styles.btn, styles.pauseBtn)} onClick={handlePause} disabled={pausing} title="Pause — stops new triggers without deleting">
              {pausing ? <MiniSpinner /> : '⏸ Pause'}
            </button>
          )}
          {workflow.status === 'paused' && (
            <button className={clsx(styles.btn, styles.activateBtn)} onClick={handleActivate} disabled={activating} title="Resume workflow">
              {activating ? <MiniSpinner /> : '▶ Resume'}
            </button>
          )}
          {workflow.status === 'paused' && (
            <button className={clsx(styles.btn, styles.deactivateBtn)} onClick={handleDeactivate} disabled={pausing} title="Return to draft">
              {pausing ? <MiniSpinner /> : '🔴 Deactivate'}
            </button>
          )}
          {workflow.status === 'active' && (
            <button className={clsx(styles.btn, styles.runBtn)} onClick={handleExecute} disabled={executing}>
              {executing ? <MiniSpinner /> : '▶ Run now'}
            </button>
          )}
          <button className={clsx(styles.btn, styles.primaryBtn)} onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Main: Canvas + Panel ── */}
      <div className={styles.body}>
        <WorkflowCanvas workflow={workflow} onRefetch={refetch} onNodeSelect={handleNodeSelect} />

        {panelOpen && (
          <div className={styles.panel}>
            {selectedNode ? (
              /* ── Node Config Panel ── */
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                workflowId={workflow.id}
                upstreamNodes={(workflow.nodes ?? []).filter(n => n.id !== selectedNode.id)}
                onClose={() => setSelectedNode(null)}
                onSaved={refetch}
              />
            ) : (
              /* ── Executions Panel ── */
              <>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Recent executions</span>
                  <button className={styles.panelRefresh} onClick={refetchExec} title="Refresh">
                    <RefreshIcon />
                  </button>
                </div>

                {/* Hint to click nodes */}
                <div className={styles.panelHint}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <circle cx="6" cy="6" r="5"/>
                    <path d="M6 4v4M6 3v.1"/>
                  </svg>
                  Click any node to configure it
                </div>

                {/* Live node status summary */}
                {activeExecutionId && Object.keys(nodeStatuses).length > 0 && (
                  <div className={styles.liveStatus}>
                    <div className={styles.liveStatusTitle}>Live node statuses</div>
                    {Object.entries(nodeStatuses).map(([nodeId, status]) => (
                      <div key={nodeId} className={styles.liveStatusRow}>
                        <div className={styles.liveStatusDot} style={{
                          background: status === 'completed' ? 'var(--green)'
                            : status === 'failed' ? 'var(--red)'
                            : status === 'running' ? 'var(--blue)'
                            : 'var(--muted)',
                          boxShadow: status === 'running' ? '0 0 8px var(--blue-glow)' : 'none',
                        }} />
                        <span className={styles.liveStatusNode}>{nodeId.slice(0, 8)}…</span>
                        <span className={styles.liveStatusVal}>{status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {executions.length === 0 ? (
                  <div className={styles.panelEmpty}>
                    <p className={styles.panelEmptyText}>No executions yet</p>
                    <p className={styles.panelEmptySub}>Run the workflow to see results here</p>
                  </div>
                ) : (
                  <div className={styles.executionList}>
                    {executions.map((ex) => (
                      <ExecutionRow
                        key={ex.id}
                        execution={ex}
                        isActive={ex.id === activeExecutionId}
                        onSelect={() => setActiveExecution(ex.id)}
                      />
                    ))}
                  </div>
                )}
              </>
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
function ExecutionRow({ execution, isActive, onSelect }: {
  execution: WorkflowExecution
  isActive: boolean
  onSelect: () => void
}) {
  const dot = STATUS_COLOR[execution.status]
  const dur = execution.startedAt && execution.completedAt
    ? Math.round(new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime())
    : null

  return (
    <div
      className={clsx(styles.execRow, isActive && styles.execRowActive)}
      onClick={onSelect}
      title="Click to watch this execution"
    >
      <div className={styles.execDot} style={{
        background: dot,
        boxShadow: execution.status === 'running' ? `0 0 8px ${dot}` : 'none',
      }} />
      <div className={styles.execInfo}>
        <div className={styles.execId}>{execution.id.slice(0, 8)}…</div>
        <div className={styles.execTime}>
          {formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}
        </div>
      </div>
      <div className={styles.execRight}>
        {dur !== null && <span className={styles.execDur}>{dur}ms</span>}
        <span className={clsx(styles.execStatus, styles[`execStatus_${execution.status}`])}>
          {execution.status}
        </span>
      </div>
    </div>
  )
}

/* ── Add Node Modal ── */
const NODE_TYPES: { type: NodeType; label: string; desc: string; color: string }[] = [
  { type: 'trigger',     label: 'Trigger',     desc: 'Webhook or schedule start',   color: '#10b981' },
  { type: 'action',      label: 'Action',      desc: 'HTTP, email, Slack, etc.',    color: '#3b82f6' },
  { type: 'condition',   label: 'Condition',   desc: 'Branch on expression result', color: '#8b5cf6' },
  { type: 'ai',          label: 'AI Node',     desc: 'LLM call with prompt',        color: '#f59e0b' },
  { type: 'transformer', label: 'Transformer', desc: 'Pick, merge, rename fields',  color: '#06b6d4' },
  { type: 'loop',        label: 'Loop',        desc: 'Iterate over an array',       color: '#f97316' },
  { type: 'delay',       label: 'Delay',       desc: 'Wait before next step',       color: '#6366f1' },
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
      if (res.success) { onAdded(); onClose() }
      else setError(res.error ?? 'Failed to add node')
    } catch {
      setError('Failed to add node')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
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
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Node type</label>
          <div className={styles.typeGrid}>
            {NODE_TYPES.map(nt => (
              <button
                key={nt.type}
                className={clsx(styles.typeCard, type === nt.type && styles.typeCardActive)}
                onClick={() => setType(nt.type)}
                style={{ '--node-type-color': nt.color } as React.CSSProperties}
              >
                <span className={styles.typeLabel} style={{ color: type === nt.type ? nt.color : undefined }}>{nt.label}</span>
                <span className={styles.typeDesc}>{nt.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.submitBtn} onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? <MiniSpinner /> : 'Add node'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function ChevronIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg> }
function PanelIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1.5" y="1.5" width="11" height="11" rx="2"/><path d="M9.5 1.5v11"/></svg> }
function RefreshIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6.5A4.5 4.5 0 112 6.5M11 2.5V6.5H7"/></svg> }
function CloseIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg> }
function MiniSpinner() { return <span className={styles.miniSpinner} /> }