export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface GraphNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Kahn's algorithm for topological sort.
 * Returns sorted node IDs and identified back-edges (recycle streams).
 */
export function topologicalSort(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { sorted: string[]; recycleEdges: GraphEdge[] } {
  const nodeIds = new Set(nodes.map(n => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  // First pass: detect back-edges by checking if removing an edge breaks a cycle
  // Simple heuristic: edges whose target has a lower or equal index in a DFS are recycle edges
  const recycleEdges: GraphEdge[] = [];
  const forwardEdges: GraphEdge[] = [];

  // Use DFS to detect back-edges
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdges = new Set<string>();

  function dfs(nodeId: string) {
    visited.add(nodeId);
    inStack.add(nodeId);

    for (const edge of edges) {
      if (edge.source !== nodeId) continue;
      if (!nodeIds.has(edge.target)) continue;

      if (inStack.has(edge.target)) {
        // Back edge found — this creates a cycle
        backEdges.add(edge.id);
      } else if (!visited.has(edge.target)) {
        dfs(edge.target);
      }
    }

    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  // Separate forward and recycle edges
  for (const edge of edges) {
    if (backEdges.has(edge.id)) {
      recycleEdges.push(edge);
    } else {
      forwardEdges.push(edge);
    }
  }

  // Build in-degree from forward edges only
  for (const edge of forwardEdges) {
    if (nodeIds.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    if (nodeIds.has(edge.source)) {
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  return { sorted, recycleEdges };
}
