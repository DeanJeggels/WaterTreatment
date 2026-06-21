import type { WaterQuality, SimulationResults } from '../types';
import type { GraphNode, GraphEdge } from './topological-sort';

/**
 * Plant mass-balance ledger (Phase 2e).
 *
 * Given the flowsheet (nodes + edges) and the SimulationResults produced by
 * `simulate()`, this builds a per-node component ledger and a plant-wide closure
 * check. It is a REPORTING layer: it reads the converged stream graph and tallies
 * component loads in/out at each node. Flow must close ~100% everywhere (no flow
 * is created or destroyed except where a split feeds an unconnected handle).
 * COD/N/P will show real treatment removal — that is expected and correct, the
 * ledger reports removal rather than requiring those components to close.
 *
 * Load convention (matches the simulator's COD-closure indicator and
 * WWTP Design.xlsm sheet 4 load definitions): load = concentration × flow,
 * in kg/d, computed as (mg/L × m³/d) / 1000. Flow's "load" is the flow itself.
 */

/** Litres-per-m³ divisor converting mg/L × m³/d to kg/d. */
const MG_PER_L_TO_KG_PER_M3 = 1000;

/** Boundary unit types that bound the plant for the plant-wide closure. */
const INFLUENT_UNIT_TYPE = 'influent';
const EFFLUENT_UNIT_TYPE = 'effluent';

/**
 * Components tracked by the ledger. `flow` is the volumetric flow (m³/d) reported
 * as its own balance; the remaining four are concentration-based loads (kg/d)
 * keyed to WaterQuality fields.
 */
const COMPONENTS: ReadonlyArray<{ component: string; field: keyof WaterQuality | null }> = [
  { component: 'flow', field: null },
  { component: 'COD', field: 'COD' },
  { component: 'TKN', field: 'TKN' },
  { component: 'TP', field: 'TP' },
  { component: 'TSS', field: 'TSS' },
];

export interface ComponentBalance {
  component: string;
  inLoad: number;
  outLoad: number;
  removedLoad: number;
  closurePct: number;
}

export interface NodeLedger {
  nodeId: string;
  unitType: string;
  balances: ComponentBalance[];
}

export interface PlantClosure {
  component: string;
  influentLoad: number;
  effluentLoad: number;
  removedOrAccumulatedLoad: number;
  closurePct: number;
}

export interface MassBalanceLedger {
  nodes: NodeLedger[];
  plant: PlantClosure[];
  worstNodeClosurePct: number;
}

/** Read a single component's load (kg/d) or flow (m³/d) from a stream. */
function componentLoad(stream: WaterQuality, field: keyof WaterQuality | null): number {
  if (field === null) return stream.flow;
  return (stream[field] * stream.flow) / MG_PER_L_TO_KG_PER_M3;
}

/**
 * Closure percentage: outLoad / inLoad × 100. Guards divide-by-zero by reporting
 * 100 when there is no load entering (nothing to close against).
 */
function closurePct(inLoad: number, outLoad: number): number {
  if (inLoad === 0) return 100;
  return (outLoad / inLoad) * 100;
}

/** Extract the unitType string declared in a node's data payload. */
function unitTypeOf(node: GraphNode): string {
  const data = node.data as { unitType?: unknown };
  return typeof data.unitType === 'string' ? data.unitType : '';
}

/**
 * Build the plant mass-balance ledger over a simulated stream graph.
 *
 * Per node:
 *  - inLoad  = sum over incoming edges of the edge-stream component load.
 *  - outLoad = sum over the node's DISTINCT output handles that actually feed a
 *    downstream edge, taken from results.nodeResults[node].outputs. Each handle
 *    is counted ONCE even if it fans out to several edges, so a split that feeds
 *    two edges from one handle is not double-counted.
 *  - For a source (influent) node, inLoad = outLoad (the plant boundary): there
 *    are no incoming edges, so the node's own output is treated as its inflow.
 *  - For a sink (effluent) node, outLoad = inLoad (the symmetric boundary): it
 *    has incoming flow but no outgoing edge, so the discharge point removes
 *    nothing of itself and closes on flow.
 *  - removedLoad = inLoad − outLoad.
 *  - closurePct  = outLoad / inLoad × 100 (100 when inLoad == 0).
 *
 * Plant-wide:
 *  - influentLoad = sum of every influent node's output load.
 *  - effluentLoad = sum of the streams on edges into effluent nodes; if an
 *    effluent node has no incoming edge, its own output is used as a fallback.
 *  - removedOrAccumulatedLoad = influentLoad − effluentLoad.
 *  - closurePct accordingly (100 when influentLoad == 0).
 *
 * worstNodeClosurePct is the per-node FLOW closure furthest from 100 across all
 * nodes (flow is the component that must conserve, so it is the meaningful health
 * signal). Defaults to 100 for an empty graph.
 */
export function computeMassBalanceLedger(
  nodes: GraphNode[],
  edges: GraphEdge[],
  results: SimulationResults
): MassBalanceLedger {
  const incomingByNode = new Map<string, GraphEdge[]>();
  const outgoingByNode = new Map<string, GraphEdge[]>();
  for (const n of nodes) {
    incomingByNode.set(n.id, []);
    outgoingByNode.set(n.id, []);
  }
  for (const e of edges) {
    incomingByNode.get(e.target)?.push(e);
    outgoingByNode.get(e.source)?.push(e);
  }

  const nodeLedgers: NodeLedger[] = [];
  let worstNodeClosurePct = 100;

  for (const node of nodes) {
    const unitType = unitTypeOf(node);
    const isInfluent = unitType === INFLUENT_UNIT_TYPE;
    const isEffluent = unitType === EFFLUENT_UNIT_TYPE;
    const incoming = incomingByNode.get(node.id) ?? [];
    const outgoing = outgoingByNode.get(node.id) ?? [];
    const nodeResult = results.nodeResults[node.id];

    // Distinct output handles that actually feed a downstream edge — counted once
    // each from the node's process outputs, so a single handle feeding multiple
    // edges is not double counted.
    const usedOutputHandles = new Set<string>(outgoing.map((e) => e.sourceHandle));

    const balances: ComponentBalance[] = COMPONENTS.map(({ component, field }) => {
      let inLoad = 0;
      for (const e of incoming) {
        const stream = results.edgeResults[e.id];
        if (stream) inLoad += componentLoad(stream, field);
      }

      let outLoad = 0;
      if (nodeResult) {
        for (const handle of usedOutputHandles) {
          const stream = nodeResult.outputs[handle];
          if (stream) outLoad += componentLoad(stream, field);
        }
      }

      // Source (influent) boundary: inLoad mirrors outLoad — the node introduces
      // the load at the plant edge rather than receiving it on an incoming line.
      if (isInfluent) inLoad = outLoad;
      // Sink (effluent) boundary: a terminal discharge point has incoming flow but
      // no outgoing edge, so it would otherwise read outLoad = 0. It is the
      // symmetric boundary to the influent — nothing is removed AT the discharge
      // point itself, so outLoad mirrors inLoad and the node closes on flow.
      if (isEffluent) outLoad = inLoad;

      const removedLoad = inLoad - outLoad;
      const pct = closurePct(inLoad, outLoad);

      if (component === 'flow' && Math.abs(pct - 100) > Math.abs(worstNodeClosurePct - 100)) {
        worstNodeClosurePct = pct;
      }

      return { component, inLoad, outLoad, removedLoad, closurePct: pct };
    });

    nodeLedgers.push({ nodeId: node.id, unitType, balances });
  }

  // Plant-wide closure across the influent/effluent boundary.
  const influentNodes = nodes.filter((n) => unitTypeOf(n) === INFLUENT_UNIT_TYPE);
  const effluentNodes = nodes.filter((n) => unitTypeOf(n) === EFFLUENT_UNIT_TYPE);

  const plant: PlantClosure[] = COMPONENTS.map(({ component, field }) => {
    let influentLoad = 0;
    for (const inf of influentNodes) {
      const nodeResult = results.nodeResults[inf.id];
      if (!nodeResult) continue;
      for (const stream of Object.values(nodeResult.outputs)) {
        influentLoad += componentLoad(stream, field);
      }
    }

    let effluentLoad = 0;
    for (const eff of effluentNodes) {
      const incoming = incomingByNode.get(eff.id) ?? [];
      if (incoming.length > 0) {
        for (const e of incoming) {
          const stream = results.edgeResults[e.id];
          if (stream) effluentLoad += componentLoad(stream, field);
        }
      } else {
        // No incoming edge drawn — fall back to the effluent node's own output.
        const nodeResult = results.nodeResults[eff.id];
        if (nodeResult) {
          for (const stream of Object.values(nodeResult.outputs)) {
            effluentLoad += componentLoad(stream, field);
          }
        }
      }
    }

    return {
      component,
      influentLoad,
      effluentLoad,
      removedOrAccumulatedLoad: influentLoad - effluentLoad,
      closurePct: closurePct(influentLoad, effluentLoad),
    };
  });

  return { nodes: nodeLedgers, plant, worstNodeClosurePct };
}
