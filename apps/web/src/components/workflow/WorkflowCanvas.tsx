import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type NodeTypes,
  type Node, type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Workflow, FlowNodeData, WorkflowNode, StepStatus } from '@/types'
import { nodesApi, edgesApi } from '@/lib/api'
import { useExecutionLiveStore } from '@/lib/store'
import { WorkflowNode as WorkflowNodeComponent } from './WorkflowNode'
import styles from './WorkflowCanvas.module.css'

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent,
}

interface Props {
  workflow: Workflow
  onRefetch?: () => void
  onNodeSelect?: (node: WorkflowNode | null) => void
}

/** Returns edge visual properties based on whether it carries a condition expression */
function buildEdgeProps(condExpr: string | null | undefined, isConditionSource: boolean): Partial<Edge> {
  if (!isConditionSource || !condExpr) {
    return {
      animated: true,
      label: undefined,
      style: { stroke: 'rgba(59,130,246,0.55)', strokeWidth: 1.5, strokeDasharray: '5 4' },
    }
  }
  const isTrue = condExpr.trim() === 'true'
  return {
    animated: true,
    label: condExpr.trim(),
    labelStyle: { fill: '#fff', fontWeight: 700, fontSize: 11 },
    labelBgStyle: {
      fill: isTrue ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.85)',
      rx: 4,
      ry: 4,
    },
    style: {
      stroke: isTrue ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)',
      strokeWidth: 2,
      strokeDasharray: '5 4',
    },
  }
}

export function WorkflowCanvas({ workflow, onNodeSelect, onRefetch }: Props) {
  const { nodeStatuses } = useExecutionLiveStore()

  // Edge branch picker state
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string } | null>(null)

  /* ── Build a set of condition node IDs for quick lookup ── */
  const conditionNodeIds = useMemo(
    () => new Set((workflow.nodes ?? []).filter((n) => n.type === 'condition').map((n) => n.id)),
    [workflow.nodes]
  )

  /* ── Convert backend nodes → React Flow nodes ── */
  const initialNodes: Node<FlowNodeData>[] = useMemo(
    () =>
      (workflow.nodes ?? []).map((n) => ({
        id: n.id,
        type: 'workflowNode',
        position: n.position ?? { x: 0, y: 0 },
        data: {
          workflowNode: n,
          executionStatus: nodeStatuses[n.id] as StepStatus | undefined,
        },
      })),
    [workflow.nodes, nodeStatuses]
  )

  /* ── Convert backend edges → React Flow edges ── */
  const initialEdges: Edge[] = useMemo(
    () =>
      (workflow.edges ?? []).map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        ...buildEdgeProps(e.conditionExpression, conditionNodeIds.has(e.sourceNodeId)),
      })),
    [workflow.edges, conditionNodeIds]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  /* Keep nodes in sync with live execution statuses */
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          executionStatus: nodeStatuses[n.id] as StepStatus | undefined,
        },
      }))
    )
  }, [nodeStatuses, setNodes])

  /* ── Persist node position after drag ── */
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await nodesApi.update(workflow.id, node.id, { position: node.position })
    },
    [workflow.id]
  )

  /* ── Connect two nodes → create edge in backend ── */
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      try {
        const res = await edgesApi.create(workflow.id, {
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        })
        if (res.success && res.data) {
          const isCondSrc = conditionNodeIds.has(connection.source)
          setEdges((eds) =>
            addEdge(
              {
                ...connection,
                id: res.data!.id,
                ...buildEdgeProps(null, isCondSrc),
              },
              eds
            )
          )
        }
      } catch {
        console.error('Failed to create edge')
      }
    },
    [workflow.id, setEdges, conditionNodeIds]
  )

  /* ── Delete edge on Backspace ── */
  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      await Promise.all(deleted.map((e) => edgesApi.delete(workflow.id, e.id)))
    },
    [workflow.id]
  )

  /* ── Edge click → open branch picker if source is a condition node ── */
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (conditionNodeIds.has(edge.source)) {
        setEdgeMenu({ edgeId: edge.id })
      }
    },
    [conditionNodeIds]
  )

  /* ── Set / clear branch label on edge ── */
  const setBranch = useCallback(
    async (branch: 'true' | 'false' | null) => {
      if (!edgeMenu) return
      try {
        await edgesApi.update(workflow.id, edgeMenu.edgeId, { conditionExpression: branch })
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edgeMenu.edgeId
              ? { ...e, ...buildEdgeProps(branch, true) }
              : e
          )
        )
        onRefetch?.()
      } catch {
        console.error('Failed to update edge branch')
      } finally {
        setEdgeMenu(null)
      }
    },
    [edgeMenu, workflow.id, setEdges, onRefetch]
  )

  /* ── Node click → open config panel ── */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FlowNodeData>) => {
      onNodeSelect?.(node.data.workflowNode)
    },
    [onNodeSelect]
  )

  /* ── Click canvas blank area → deselect + close menus ── */
  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null)
    setEdgeMenu(null)
  }, [onNodeSelect])

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Backspace"
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="var(--t4)"
          maskColor="var(--glass)"
          style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-2)' }}
        />
      </ReactFlow>

      {/* ── Edge branch picker popup ── */}
      {edgeMenu && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'var(--bg-elevated, #1e1e2e)',
          border: '1px solid var(--border-2, rgba(255,255,255,0.12))',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          minWidth: 230,
        }}>
          <div style={{ fontSize: 11, color: 'var(--t3, rgba(255,255,255,0.45))', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Condition branch
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setBranch('true')}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(22,163,74,0.18)', color: '#4ade80', fontWeight: 700, fontSize: 13,
                border: '1px solid rgba(34,197,94,0.4)',
              }}
            >
              ✓ True
            </button>
            <button
              onClick={() => setBranch('false')}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(220,38,38,0.18)', color: '#f87171', fontWeight: 700, fontSize: 13,
                border: '1px solid rgba(239,68,68,0.4)',
              }}
            >
              ✗ False
            </button>
          </div>
          <button
            onClick={() => setBranch(null)}
            style={{
              padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border-2, rgba(255,255,255,0.1))',
              background: 'transparent', color: 'var(--t3, rgba(255,255,255,0.4))', fontSize: 12,
            }}
          >
            Clear branch label
          </button>
        </div>
      )}
    </div>
  )
}
