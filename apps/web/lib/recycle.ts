import { detectRecycleEdges } from '@repo/sim-engine';
import type { FlowsheetNode, FlowsheetEdge } from '@/stores/flowsheet-store';

/**
 * Compute the set of edge ids that the simulator treats as recycle (back-)edges,
 * using the same detection the engine relies on. Shared by the Canvas (for dashed
 * recycle styling) and the Inspector (for the ratio editor) so both stay in sync.
 */
export function getRecycleEdgeIds(
  nodes: FlowsheetNode[],
  edges: FlowsheetEdge[]
): Set<string> {
  const simNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'processUnit',
    data: n.data as Record<string, unknown>,
  }));
  const simEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? 'out',
    targetHandle: e.targetHandle ?? 'in',
  }));
  return new Set(detectRecycleEdges(simNodes, simEdges).map((e) => e.id));
}
