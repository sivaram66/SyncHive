import { describe, it, expect } from 'vitest'
import { buildDAG, topologicalSort, getNextNodes } from '../src/executor/dag'
import type { WorkflowSnapshot } from '@synchive/shared-types'

// ── Helpers ──────────────────────────────────────────────────────────
function makeNode(id: string, type = 'action'): WorkflowSnapshot['nodes'][number] {
  return { id, type: type as any, name: id, config: {}, position: { x: 0, y: 0 } }
}

function makeEdge(src: string, tgt: string): WorkflowSnapshot['edges'][number] {
  return { id: `${src}->${tgt}`, sourceNodeId: src, targetNodeId: tgt, conditionExpression: null }
}

function snapshot(nodes: string[], edges: [string, string][]): WorkflowSnapshot {
  return {
    nodes: nodes.map(n => makeNode(n)),
    edges: edges.map(([s, t]) => makeEdge(s, t)),
  }
}

// ── buildDAG ─────────────────────────────────────────────────────────
describe('buildDAG', () => {
  it('marks nodes with no incoming edges as entry nodes', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]))
    expect(dag.entryNodes).toEqual(['A'])
  })

  it('computes inDegree correctly', () => {
    // A → C, B → C  (both feed into C)
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']]))
    expect(dag.nodes.get('C')!.inDegree).toBe(2)
    expect(dag.nodes.get('A')!.inDegree).toBe(0)
    expect(dag.nodes.get('B')!.inDegree).toBe(0)
    expect(dag.entryNodes.sort()).toEqual(['A', 'B'])
  })

  it('populates outgoing and incoming edges', () => {
    const dag = buildDAG(snapshot(['A', 'B'], [['A', 'B']]))
    expect(dag.nodes.get('A')!.outgoingEdges).toHaveLength(1)
    expect(dag.nodes.get('B')!.incomingEdges).toHaveLength(1)
    expect(dag.nodes.get('A')!.outgoingEdges[0].targetNodeId).toBe('B')
  })

  it('handles an empty snapshot', () => {
    const dag = buildDAG(snapshot([], []))
    expect(dag.nodes.size).toBe(0)
    expect(dag.entryNodes).toHaveLength(0)
  })

  it('ignores edges whose source or target is not in the node list', () => {
    const dag = buildDAG(snapshot(['A'], [['A', 'GHOST']]))
    expect(dag.nodes.get('A')!.outgoingEdges).toHaveLength(0)
  })
})

// ── topologicalSort ───────────────────────────────────────────────────
describe('topologicalSort', () => {
  it('produces a single level for a single node', () => {
    const dag = buildDAG(snapshot(['A'], []))
    const levels = topologicalSort(dag)
    expect(levels).toEqual([['A']])
  })

  it('linear chain A → B → C produces three levels', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]))
    const levels = topologicalSort(dag)
    expect(levels).toEqual([['A'], ['B'], ['C']])
  })

  it('fan-out: A → B and A → C produces two levels with B and C parallel', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]))
    const levels = topologicalSort(dag)
    expect(levels[0]).toEqual(['A'])
    expect(levels[1].sort()).toEqual(['B', 'C'])
  })

  it('fan-in: A → C, B → C puts A and B in level 0, C in level 1', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']]))
    const levels = topologicalSort(dag)
    expect(levels[0].sort()).toEqual(['A', 'B'])
    expect(levels[1]).toEqual(['C'])
  })

  it('diamond: A → B, A → C, B → D, C → D', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C', 'D'], [
      ['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'],
    ]))
    const levels = topologicalSort(dag)
    expect(levels[0]).toEqual(['A'])
    expect(levels[1].sort()).toEqual(['B', 'C'])
    expect(levels[2]).toEqual(['D'])
  })

  it('throws on a cycle', () => {
    const dag = buildDAG(snapshot(['A', 'B'], [['A', 'B'], ['B', 'A']]))
    expect(() => topologicalSort(dag)).toThrow(/cycle/i)
  })

  it('handles disconnected graph (two independent chains)', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C', 'D'], [['A', 'B'], ['C', 'D']]))
    const levels = topologicalSort(dag)
    const allNodes = levels.flat().sort()
    expect(allNodes).toEqual(['A', 'B', 'C', 'D'])
    // Both A and C must be in level 0
    expect(levels[0].sort()).toEqual(['A', 'C'])
  })
})

// ── getNextNodes ──────────────────────────────────────────────────────
describe('getNextNodes', () => {
  it('returns direct children when their dependencies are met', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]))
    const next = getNextNodes(dag, 'A', new Set(['A']))
    expect(next.sort()).toEqual(['B', 'C'])
  })

  it('does not return a node whose other dependency is not yet completed', () => {
    // A → C and B → C: C should NOT be next after only A completes
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']]))
    const next = getNextNodes(dag, 'A', new Set(['A']))
    expect(next).toHaveLength(0)
  })

  it('returns C once both A and B have completed', () => {
    const dag = buildDAG(snapshot(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']]))
    const next = getNextNodes(dag, 'B', new Set(['A', 'B']))
    expect(next).toEqual(['C'])
  })

  it('does not re-queue already-completed nodes', () => {
    const dag = buildDAG(snapshot(['A', 'B'], [['A', 'B']]))
    // B is already completed
    const next = getNextNodes(dag, 'A', new Set(['A', 'B']))
    expect(next).toHaveLength(0)
  })

  it('returns empty array for a leaf node', () => {
    const dag = buildDAG(snapshot(['A', 'B'], [['A', 'B']]))
    const next = getNextNodes(dag, 'B', new Set(['A', 'B']))
    expect(next).toHaveLength(0)
  })
})

// ── condition expression ──────────────────────────────────────────────
describe('condition edge conditionExpression', () => {
  it('condition edges carry conditionExpression from snapshot', () => {
    const snap: WorkflowSnapshot = {
      nodes: [makeNode('A', 'condition'), makeNode('B'), makeNode('C')],
      edges: [
        { id: 'e1', sourceNodeId: 'A', targetNodeId: 'B', conditionExpression: 'true' },
        { id: 'e2', sourceNodeId: 'A', targetNodeId: 'C', conditionExpression: 'false' },
      ],
    }
    const dag = buildDAG(snap)
    const conditionNode = dag.nodes.get('A')!
    const trueEdge  = conditionNode.outgoingEdges.find(e => e.conditionExpression === 'true')
    const falseEdge = conditionNode.outgoingEdges.find(e => e.conditionExpression === 'false')
    expect(trueEdge?.targetNodeId).toBe('B')
    expect(falseEdge?.targetNodeId).toBe('C')
  })
})
