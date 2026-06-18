/**
 * Spine ordering + banding (T4.2). REUSES sim-engine topologicalSort to order
 * the objects along the process flow, then assigns each a horizontal band:
 *   A (top)    sludge — thickener, dewatering
 *   B (middle) main water line  ← the primary spine
 *   C (bottom) chemical + electrical + utility — dosing, blower, MCC, building
 * Keeps electrical/chemical separated from the wet line by construction.
 * Deterministic.
 */
import { topologicalSort } from '@repo/sim-engine';
import type { GraphNode, GraphEdge } from '@repo/sim-engine';
import type { EngineeringObject } from '@repo/object-model';

export type Band = 'A' | 'B' | 'C';

const BAND_BY_CLASS: Record<string, Band> = {
  thickener: 'A',
  dewatering: 'A',
  dosing_skid: 'C',
  blower: 'C',
  electrical_room: 'C',
  building: 'C',
};

export function bandFor(obj: EngineeringObject): Band {
  return BAND_BY_CLASS[obj.class] ?? 'B';
}

export interface OrderedLayout {
  /** All objects in topological (process-flow) order. */
  ordered: EngineeringObject[];
  /** Band B objects in topo order — the main spine. */
  spine: EngineeringObject[];
  bandOf: Map<string, Band>;
}

export function orderAndBand(objects: EngineeringObject[]): OrderedLayout {
  const ids = new Set(objects.map((o) => o.id));
  const nodes: GraphNode[] = objects.map((o) => ({ id: o.id, type: o.class, data: {} }));
  const edges: GraphEdge[] = objects.flatMap((o) =>
    o.connections
      .filter((c) => ids.has(c.toObjectId))
      .map((c, i) => ({
        id: `${o.id}->${c.toObjectId}#${i}`,
        source: o.id,
        target: c.toObjectId,
        sourceHandle: '',
        targetHandle: '',
      })),
  );

  const { sorted } = topologicalSort(nodes, edges);
  const rank = new Map(sorted.map((id, i) => [id, i] as const));
  const ordered = [...objects].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const bandOf = new Map<string, Band>(objects.map((o) => [o.id, bandFor(o)]));
  const spine = ordered.filter((o) => bandOf.get(o.id) === 'B');

  return { ordered, spine, bandOf };
}
