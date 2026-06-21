import type { WaterQuality, SimulationResults, UnitType, ProcessResult, UpstreamContext } from '../types';
import { emptyWaterQuality } from '../types';
import { topologicalSort } from './topological-sort';
import type { GraphNode, GraphEdge } from './topological-sort';
import { createUnit } from '../units/index';

const MAX_ITERATIONS = 50;
const CONVERGENCE_TOLERANCE = 0.01; // 1% relative change between sweeps
// Recycle ratio used only if a drawn recycle line omits its own ratio. Kept here
// as a UI/topology default, not a process constant — the engineering value lives
// on the edge (the line the user draws).
const DEFAULT_RECYCLE_RATIO = 1;

// The "product" output handle of each multi-outlet block: the clarified,
// effluent-bound stream (as opposed to the concentrate/sludge/reject stream).
// Node-level flow conservation routes the conserved remainder onto this handle,
// so recycle drawn off the OTHER (concentrate) handle is removed from the flow
// that continues toward the effluent — the recycle loop stays internal.
// Single-outlet blocks default to 'out'.
const PRODUCT_HANDLE: Partial<Record<UnitType, string>> = {
  secondary_clarifier: 'overflow',
  primary_clarifier: 'overflow',
  thickener: 'overflow',
  dewatering: 'filtrate',
  mbr: 'permeate',
  splitter: 'main',
};

/** Resolve the product (clarified, effluent-bound) handle for a unit's outputs. */
function productHandleOf(unitType: UnitType, outputs: Record<string, WaterQuality>): string {
  const mapped = PRODUCT_HANDLE[unitType];
  if (mapped && outputs[mapped]) return mapped;
  if (outputs.out) return 'out';
  const keys = Object.keys(outputs);
  return keys.length > 0 ? keys[0]! : 'out';
}

interface NodeData {
  unitType: UnitType;
  parameters: Record<string, number>;
}

/**
 * Run the flowsheet simulation as a connected stream graph.
 *
 * Each block consumes the ACTUAL streams on its incoming edges (the upstream
 * effluent), evaluates `process(inputs) -> outputs`, and the solver propagates
 * every output stream onto the edges leaving that block — block by block, in
 * dependency (topological) order.
 *
 * The graph is NOT assumed acyclic: RAS and internal recycle lines make it
 * cyclic. Recycle (back-)edges are detected, and the whole graph is swept
 * repeatedly (Gauss–Seidel) until every stream value stabilises within
 * CONVERGENCE_TOLERANCE. Recycle flows build up from zero by propagation — there
 * is no global "Q_basis" pin; a recycle line's flow is its ratio times the LOCAL
 * forward inflow to the node it returns to (i.e. the influent feeding that
 * reactor group), which generalises correctly to multi-influent and sub-train
 * recycles while matching "ratio × influent" for the standard single-feed plant.
 */
export function simulate(
  nodes: GraphNode[],
  edges: GraphEdge[]
): SimulationResults {
  const { sorted, recycleEdges } = topologicalSort(nodes, edges);
  const recycleEdgeIds = new Set<string>(recycleEdges.map(e => e.id));

  // Indexes for O(1) traversal during the sweep.
  const nodeById = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
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

  // Edge state: the Stream currently on each edge. Everything starts empty
  // (zero flow); forward edges fill in on the first sweep (topological order),
  // recycle edges build up over subsequent sweeps until they converge.
  const edgeState = new Map<string, WaterQuality>();
  for (const edge of edges) {
    edgeState.set(edge.id, emptyWaterQuality());
  }

  // Local reference flow a recycle ratio multiplies: the sum of flows on the
  // recycle target's FORWARD (non-recycle) incoming edges — the fresh influent
  // entering that reactor group from outside the loop. Available when we set the
  // recycle edge because the target is upstream of the source (it is a back-edge),
  // so its forward inflows come from already-evaluated nodes.
  const forwardInflow = (nodeId: string): number => {
    let q = 0;
    for (const e of incomingByNode.get(nodeId) ?? []) {
      if (!recycleEdgeIds.has(e.id)) q += edgeState.get(e.id)!.flow;
    }
    return q;
  };

  const nodeResults = new Map<string, ProcessResult>();
  let converged = false;
  let iteration = 0;

  for (iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    // Snapshot recycle streams to test for convergence after this sweep.
    const prevRecycle = new Map<string, WaterQuality>();
    for (const re of recycleEdges) {
      prevRecycle.set(re.id, { ...edgeState.get(re.id)! });
    }

    for (const nodeId of sorted) {
      const node = nodeById.get(nodeId);
      if (!node) continue;

      const nodeData = node.data as unknown as NodeData;
      const unit = createUnit(nodeData.unitType, nodeData.parameters);

      // Inputs are the actual streams on the incoming edges (upstream effluent).
      const incoming = incomingByNode.get(nodeId) ?? [];
      const inputs: WaterQuality[] = incoming
        .map(e => edgeState.get(e.id)!)
        .filter(wq => wq.flow > 0);

      // Sizing-hint side channel (e.g. blower reading its aerobic reactor's O₂
      // demand). This is metadata, not a Stream — flagged for removal in Phase 2
      // when the blower folds into the aerobic reactor.
      const upstreamContext: UpstreamContext = { nodeMetadata: {} };
      for (const e of incoming) {
        const sourceResult = nodeResults.get(e.source);
        if (sourceResult?.metadata) {
          upstreamContext.nodeMetadata[e.targetHandle] = sourceResult.metadata;
        }
      }

      const result = unit.process(inputs, upstreamContext);
      nodeResults.set(nodeId, result);

      // ── Propagate this node's outputs onto its outgoing edges, enforcing
      // NODE-LEVEL FLOW CONSERVATION across handles. ───────────────────────────
      // A recycle line is a closed loop: whatever flow it returns upstream must be
      // removed again from the flow heading to the discharge, or the recycle
      // inflates the effluent (a 6× IMLR made a 40 m³/d plant "discharge" 274 m³/d
      // because a separator's product handle was never reduced by the recycle drawn
      // off its reject handle). The conservation rule, applied per node:
      //   product (clarified, effluent-bound) forward flow
      //       = inflow − Σ(all recycle draws) − Σ(concentrate/sludge forward)
      // Since the inflow is itself inflated by exactly the recycle that loops back,
      // the product collapses to the NET feed and the loop stays internal. Stream
      // CONCENTRATIONS still come from each block's process() output; only the
      // volumetric flow on the product handle is balanced here.
      const outgoing = outgoingByNode.get(nodeId) ?? [];
      const incomingFlow = incoming.reduce((q, e) => q + (edgeState.get(e.id)?.flow ?? 0), 0);
      const isSource = incoming.length === 0;
      const productHandle = productHandleOf(nodeData.unitType, result.outputs);

      const setEven = (edgesOnHandle: GraphEdge[], wq: WaterQuality, flow: number) => {
        const perEdge = flow / edgesOnHandle.length;
        for (const fe of edgesOnHandle) edgeState.set(fe.id, { ...wq, flow: perEdge });
      };

      // Pass 1 — every recycle edge (any handle): flow = ratio × local forward
      // inflow to its target, carrying the source concentrations.
      let totalRecycleFlow = 0;
      for (const e of outgoing) {
        if (!recycleEdgeIds.has(e.id)) continue;
        const wq = result.outputs[e.sourceHandle];
        if (!wq) continue;
        const recycleFlow = (e.recycleRatio ?? DEFAULT_RECYCLE_RATIO) * forwardInflow(e.target);
        edgeState.set(e.id, { ...wq, flow: recycleFlow });
        totalRecycleFlow += recycleFlow;
      }

      // Pass 2 — every NON-product output handle the block produced is concentrate
      // /sludge leaving the block. It is counted as removed flow whether or not its
      // downstream pipe is drawn (sludge still exits the clarifier even if you did
      // not draw the sludge line), net of any recycle drawn off that same handle.
      // This both (a) reproduces each block's own split exactly when there is no
      // recycle and (b) prevents a fixed-fraction split being applied to recycle-
      // inflated flow when there is.
      let totalNonProductForward = 0;
      for (const handle of Object.keys(result.outputs)) {
        if (handle === productHandle) continue;
        const wq = result.outputs[handle];
        if (!wq) continue;
        const recycleOnHandle = outgoing
          .filter(e => e.sourceHandle === handle && recycleEdgeIds.has(e.id))
          .reduce((s, e) => s + (edgeState.get(e.id)?.flow ?? 0), 0);
        const handleForward = Math.max(0, wq.flow - recycleOnHandle);
        totalNonProductForward += handleForward;
        const forwardEdges = outgoing.filter(e => e.sourceHandle === handle && !recycleEdgeIds.has(e.id));
        if (forwardEdges.length > 0) {
          setEven(forwardEdges, wq, handleForward);
          if (forwardEdges.length > 1) {
            (result.warnings ??= []).push(
              `Handle "${handle}" fans out to ${forwardEdges.length} forward edges; flow split evenly. Use a splitter block for explicit ratios.`
            );
          }
        }
      }

      // Pass 3 — the product handle's forward edges carry the conserved remainder.
      // Sources (influent) have no inflow to conserve, so they emit their own flow.
      const productForwardEdges = outgoing.filter(e => e.sourceHandle === productHandle && !recycleEdgeIds.has(e.id));
      if (productForwardEdges.length > 0) {
        const wq = result.outputs[productHandle];
        if (wq) {
          const recycleOnProduct = outgoing
            .filter(e => e.sourceHandle === productHandle && recycleEdgeIds.has(e.id))
            .reduce((s, e) => s + (edgeState.get(e.id)?.flow ?? 0), 0);
          const productForward = isSource
            ? Math.max(0, wq.flow - recycleOnProduct)
            : Math.max(0, incomingFlow - totalRecycleFlow - totalNonProductForward);
          setEven(productForwardEdges, wq, productForward);
          if (productForwardEdges.length > 1) {
            (result.warnings ??= []).push(
              `Handle "${productHandle}" fans out to ${productForwardEdges.length} forward edges; flow split evenly. Use a splitter block for explicit ratios.`
            );
          }
        }
      }

      if (!isSource && totalRecycleFlow > incomingFlow + 1e-6) {
        (result.warnings ??= []).push(
          `Recycle draw (${totalRecycleFlow.toFixed(1)} m³/d) exceeds inflow (${incomingFlow.toFixed(1)} m³/d); check recycle ratios.`
        );
      }
    }

    // No recycle → a single forward sweep is the exact solution.
    if (recycleEdges.length === 0) {
      converged = true;
      break;
    }

    // Converged when every recycle stream stopped moving within tolerance.
    converged = true;
    const keys: (keyof WaterQuality)[] = ['flow', 'TSS', 'NO3N', 'NH3N', 'COD'];
    for (const re of recycleEdges) {
      const prev = prevRecycle.get(re.id)!;
      const curr = edgeState.get(re.id)!;
      for (const key of keys) {
        const prevVal = prev[key] as number;
        const currVal = curr[key] as number;
        if (prevVal === 0 && currVal === 0) continue;
        const denom = Math.max(Math.abs(prevVal), Math.abs(currVal), 1);
        if (Math.abs(currVal - prevVal) / denom > CONVERGENCE_TOLERANCE) {
          converged = false;
          break;
        }
      }
      if (!converged) break;
    }
    if (converged) break;
  }

  // Plant-level warning: recycle drawn but no influent reaches it, so it carries
  // no flow (ratio × 0). Surfaced once, after convergence.
  const warnings: string[] = [];
  if (recycleEdges.length > 0 && recycleEdges.every(re => edgeState.get(re.id)!.flow <= 0)) {
    warnings.push(
      'Recycle line(s) present but plant influent flow is 0 — recycle streams carry no flow. Set the influent flow.'
    );
  }

  // Plant-wide COD closure indicator (COD load in at influents vs out at effluents).
  const influentNodes = nodes.filter(n => (n.data as unknown as NodeData).unitType === 'influent');
  const effluentNodes = nodes.filter(n => (n.data as unknown as NodeData).unitType === 'effluent');

  let totalCODIn = 0;
  for (const inf of influentNodes) {
    const result = nodeResults.get(inf.id);
    const outWQ = result ? Object.values(result.outputs)[0] : undefined;
    if (outWQ) totalCODIn += outWQ.COD * outWQ.flow;
  }

  let totalCODOut = 0;
  for (const eff of effluentNodes) {
    for (const e of incomingByNode.get(eff.id) ?? []) {
      const wq = edgeState.get(e.id);
      if (wq) totalCODOut += wq.COD * wq.flow;
    }
  }

  const massBalanceError = totalCODIn > 0 ? Math.abs(totalCODIn - totalCODOut) / totalCODIn : 0;

  const finalNodeResults: Record<string, ProcessResult> = {};
  for (const [id, result] of nodeResults) finalNodeResults[id] = result;

  const finalEdgeResults: Record<string, WaterQuality> = {};
  for (const [id, wq] of edgeState) finalEdgeResults[id] = wq;

  return {
    nodeResults: finalNodeResults,
    edgeResults: finalEdgeResults,
    converged,
    iterations: iteration,
    massBalanceError,
    warnings,
  };
}
