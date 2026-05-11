import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import clsx from 'clsx'
import type { FlowNodeData, NodeType, StepStatus } from '@/types'
import styles from './WorkflowNode.module.css'

const NODE_META: Record<NodeType, { label: string; icon: React.ReactNode }> = {
  trigger: {
    label: 'Trigger',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1L1 6h3v5l5-5H6V1z"/>
      </svg>
    ),
  },
  action: {
    label: 'Action',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6h8M6 2l4 4-4 4"/>
      </svg>
    ),
  },
  condition: {
    label: 'Condition',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1L11 6 6 11 1 6z"/>
      </svg>
    ),
  },
  ai: {
    label: 'AI',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="6" r="4"/>
        <path d="M6 3v3l2 1"/>
      </svg>
    ),
  },
  transformer: {
    label: 'Transform',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 4h5M5 2l2 2-2 2M10 8H5M7 6l2 2-2 2"/>
      </svg>
    ),
  },
  loop: {
    label: 'Loop',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4H4a2 2 0 000 4h5M7 2l2 2-2 2"/>
      </svg>
    ),
  },
}

const STATUS_LABELS: Record<StepStatus, string> = {
  pending:   'Pending',
  running:   'Running',
  completed: 'Done',
  failed:    'Failed',
  skipped:   'Skipped',
  retrying:  'Retrying',
  timed_out: 'Timeout',
}

const STATUS_ICONS: Record<StepStatus, React.ReactNode> = {
  pending: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="5" cy="5" r="4"/>
    </svg>
  ),
  running: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="animate-spin">
      <path d="M5 1a4 4 0 014 4"/>
    </svg>
  ),
  completed: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5.5L4 8l4.5-5"/>
    </svg>
  ),
  failed: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 2l6 6M8 2l-6 6"/>
    </svg>
  ),
  skipped: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 3l4 2-4 2V3zM8 3v4"/>
    </svg>
  ),
  retrying: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3H4a2 2 0 000 4h4M6 1l2 2-2 2"/>
    </svg>
  ),
  timed_out: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="5" cy="5" r="4"/>
      <path d="M5 2.5V5l2 1"/>
    </svg>
  ),
}

export const WorkflowNode = memo(function WorkflowNode(props: { data: FlowNodeData; selected?: boolean }) {
  const { workflowNode, executionStatus } = props.data as FlowNodeData
  const { name, type } = workflowNode
  const meta = NODE_META[type as NodeType]

  return (
    <div className={clsx(
      styles.node,
      styles[`type_${type}`],
      props.selected && styles.selected,
      executionStatus && styles[`status_${executionStatus}`],
    )}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.typeBar} />

      <div className={styles.body}>
        <div className={styles.eyebrow}>
          <span className={styles.typeIcon}>{meta.icon}</span>
          <span className={styles.typeLabel}>{meta.label}</span>
        </div>
        <div className={styles.title}>{name}</div>

        {executionStatus && (
          <div className={clsx(styles.statusChip, styles[`chip_${executionStatus}`])}>
            <span className={clsx(
              styles.statusIcon,
              executionStatus === 'running' && styles.spinIcon,
            )}>
              {STATUS_ICONS[executionStatus]}
            </span>
            {STATUS_LABELS[executionStatus]}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  )
})
