import { WorkflowSnapshot, SnapshotNode, SnapshotEdge } from "@synchive/shared-types";

export interface DAGNode {
  node: SnapshotNode;
  incomingEdges: SnapshotEdge[];
  outgoingEdges: SnapshotEdge[];
  inDegree: number; // number of dependencies
}

export interface DAGGraph {
  nodes: Map<string, DAGNode>;
  entryNodes: string[]; // nodes with no incoming edges (triggers)
}

/**
 * Build an adjacency list representation of the workflow DAG
 * from the version snapshot.
 */
export function buildDAG(snapshot: WorkflowSnapshot): DAGGraph {
  const nodes = new Map<string, DAGNode>();

  // Initialize all nodes
  for (const node of snapshot.nodes) {
    nodes.set(node.id, {
      node,
      incomingEdges: [],
      outgoingEdges: [],
      inDegree: 0,
    });
  }

  // Populate edges
  for (const edge of snapshot.edges) {
    const source = nodes.get(edge.sourceNodeId);
    const target = nodes.get(edge.targetNodeId);

    if (source && target) {
      source.outgoingEdges.push(edge);
      target.incomingEdges.push(edge);
      target.inDegree++;
    }
  }

  // Find entry nodes (inDegree === 0)
  const entryNodes: string[] = [];
  for (const [nodeId, dagNode] of nodes) {
    if (dagNode.inDegree === 0) {
      entryNodes.push(nodeId);
    }
  }

  return { nodes, entryNodes };
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns nodes in execution order.
 * Throws if the graph has a cycle.
 */
export function topologicalSort(dag: DAGGraph): string[][] {
  const levels: string[][] = [];
  const inDegrees = new Map<string, number>();
  const queue: string[] = [];

  // Copy inDegree values
  for (const [nodeId, dagNode] of dag.nodes) {
    inDegrees.set(nodeId, dagNode.inDegree);
    if (dagNode.inDegree === 0) {
      queue.push(nodeId);
    }
  }

  let processedCount = 0;

  while (queue.length > 0) {
    // All nodes in the current queue can execute in parallel
    const currentLevel = [...queue];
    levels.push(currentLevel);
    queue.length = 0; // clear the queue

    for (const nodeId of currentLevel) {
      processedCount++;
      const dagNode = dag.nodes.get(nodeId)!;

      // Reduce inDegree for all downstream nodes
      for (const edge of dagNode.outgoingEdges) {
        const targetDegree = inDegrees.get(edge.targetNodeId)!;
        const newDegree = targetDegree - 1;
        inDegrees.set(edge.targetNodeId, newDegree);

        if (newDegree === 0) {
          queue.push(edge.targetNodeId);
        }
      }
    }
  }

  // If we didn't process all nodes, there's a cycle
  if (processedCount !== dag.nodes.size) {
    throw new Error(
      `Workflow graph contains a cycle. Processed ${processedCount} of ${dag.nodes.size} nodes.`
    );
  }

  return levels;
}

/**
 * Get the next executable nodes after a given node completes.
 * Checks if all dependencies of each downstream node are satisfied.
 */
export function getNextNodes(
  dag: DAGGraph,
  completedNodeId: string,
  completedNodeIds: Set<string>
): string[] {
  const dagNode = dag.nodes.get(completedNodeId);
  if (!dagNode) return [];

  const nextNodes: string[] = [];

  for (const edge of dagNode.outgoingEdges) {
    const targetNode = dag.nodes.get(edge.targetNodeId);
    if (!targetNode) continue;

    // Check if ALL incoming dependencies are satisfied
    const allDependenciesMet = targetNode.incomingEdges.every((inEdge) =>
      completedNodeIds.has(inEdge.sourceNodeId)
    );

    if (allDependenciesMet && !completedNodeIds.has(edge.targetNodeId)) {
      nextNodes.push(edge.targetNodeId);
    }
  }

  return nextNodes;
}
