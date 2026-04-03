import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import type { FlowNodeData, NodeType, StepStatus } from '@/types'
import styles from './WorkflowNode.module.css'

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger:     'Trigger',
  action:      'Action',
  condition:   'Condition',
  ai:          'AI Node',
  transformer: 'Transformer',
  loop:        'Loop',
}

const STATUS_LABELS: Record<StepStatus, string> = {
  pending:   'pending',
  running:   'running',
  completed: 'done',
  failed:    'failed',
  skipped:   'skipped',
  retrying:  'retrying',
  timed_out: 'timeout',
}

export const WorkflowNode = memo(function WorkflowNode({
  data,
  selected,
}: NodeProps<FlowNodeData>) {
  const { workflowNode, executionStatus } = data
  const { name, type } = workflowNode

  return (
    <div className={clsx(styles.node, selected && styles.selected, executionStatus && styles[executionStatus])}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.eyebrow}>{NODE_TYPE_LABELS[type]}</div>
      <div className={styles.title}>{name}</div>

      {executionStatus && (
        <div className={clsx(styles.chip, styles[`chip_${executionStatus}`])}>
          <span className={clsx(styles.chipDot, executionStatus === 'running' && styles.dotPulse)} />
          {STATUS_LABELS[executionStatus]}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  )
})
