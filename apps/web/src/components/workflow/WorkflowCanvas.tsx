import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type NodeTypes,
  type Node, type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Workflow, FlowNodeData, StepStatus } from '@/types'
import { nodesApi, edgesApi } from '@/lib/api'
import { useExecutionLiveStore } from '@/lib/store'
import { WorkflowNode } from './WorkflowNode'
import styles from './WorkflowCanvas.module.css'

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
}

interface Props {
  workflow: Workflow
  onRefetch: () => void
}

export function WorkflowCanvas({ workflow, onRefetch }: Props) {
  const { nodeStatuses } = useExecutionLiveStore()

  /* ── Convert backend nodes → React Flow nodes ── */
  const initialNodes: Node<FlowNodeData>[] = useMemo(() => {
    return (workflow.nodes ?? []).map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: n.position ?? { x: 0, y: 0 },
      data: {
        workflowNode: n,
        executionStatus: nodeStatuses[n.id] as StepStatus | undefined,
      },
    }))
  }, [workflow.nodes, nodeStatuses])

  /* ── Convert backend edges → React Flow edges ── */
  const initialEdges: Edge[] = useMemo(() => {
    return (workflow.edges ?? []).map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.label ?? undefined,
      animated: true,
      style: { stroke: 'var(--gb2)', strokeWidth: 1.5, strokeDasharray: '5 4' },
    }))
  }, [workflow.edges])

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
      await nodesApi.update(workflow.id, node.id, {
        position: node.position,
      })
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
          setEdges((eds) =>
            addEdge(
              {
                ...connection,
                id: res.data!.id,
                animated: true,
                style: { stroke: 'var(--gb2)', strokeWidth: 1.5, strokeDasharray: '5 4' },
              },
              eds
            )
          )
        }
      } catch {
        console.error('Failed to create edge')
      }
    },
    [workflow.id, setEdges]
  )

  /* ── Delete edge on selection + backspace ── */
  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      await Promise.all(
        deleted.map((e) => edgesApi.delete(workflow.id, e.id))
      )
    },
    [workflow.id]
  )

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
          color="var(--gb1)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="var(--t4)"
          maskColor="var(--glass)"
          style={{ background: 'var(--s1)', border: '0.5px solid var(--gb2)' }}
        />
      </ReactFlow>
    </div>
  )
}
