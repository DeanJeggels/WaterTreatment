import type { WaterQuality, SimulationResults, UnitType, ProcessResult, UpstreamContext } from '../types';
import { emptyWaterQuality } from '../types';
import { topologicalSort } from './topological-sort';
import type { GraphNode, GraphEdge } from './topological-sort';
import { createUnit } from '../units/index';

const MAX_ITERATIONS = 50;
const CONVERGENCE_TOLERANCE = 0.01; // 1% relative change

interface NodeData {
  unitType: UnitType;
  parameters: Record<string, number>;
}

/**
 * Run the simulation on a flowsheet graph.
 * Handles recycle streams via iterative convergence.
 */
export function simulate(
  nodes: GraphNode[],
  edges: GraphEdge[]
): SimulationResults {
  const { sorted, recycleEdges } = topologicalSort(nodes, edges);

  // O(1) lookup for recycle (back-)edges
  const recycleEdgeIds = new Set<string>(recycleEdges.map(e => e.id));

  // Q_basis = total plant raw influent = sum of every influent node's declared flow.
  // Reading the node param `flow` is order-independent and pins the recycle flow across
  // iterations (recycle flow = ratio × Q_basis), which guarantees convergence.
  const Q_basis = nodes.reduce((sum, n) => {
    const nd = n.data as unknown as NodeData;
    if (nd.unitType === 'influent') {
      return sum + (nd.parameters?.flow ?? 0);
    }
    return sum;
  }, 0);

  // Edge state: water quality on each edge
  const edgeState = new Map<string, WaterQuality>();
  for (const edge of edges) {
    edgeState.set(edge.id, emptyWaterQuality());
  }

  // Initialize recycle edges with reasonable guesses
  for (const re of recycleEdges) {
    const guess = emptyWaterQuality();
    guess.flow = 1000; // reasonable default
    guess.TSS = 5000; // MLSS-like for RAS
    guess.COD = 50;
    guess.sCOD = 20;
    guess.NH3N = 2;
    guess.NO3N = 10;
    guess.temperature = 20;
    guess.pH = 7;
    guess.alkalinity = 3;
    edgeState.set(re.id, guess);
  }

  const nodeResults = new Map<string, ProcessResult>();
  let converged = false;
  let iteration = 0;

  for (iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    // Snapshot recycle values for convergence check
    const prevRecycleValues = new Map<string, WaterQuality>();
    for (const re of recycleEdges) {
      const current = edgeState.get(re.id)!;
      prevRecycleValues.set(re.id, { ...current });
    }

    // Evaluate each node in topological order
    for (const nodeId of sorted) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const nodeData = node.data as unknown as NodeData;
      const unit = createUnit(nodeData.unitType, nodeData.parameters);

      // Gather inputs from incoming edges
      const incomingEdges = edges.filter(e => e.target === nodeId);
      const inputs: WaterQuality[] = incomingEdges
        .map(e => edgeState.get(e.id))
        .filter((wq): wq is WaterQuality => wq !== undefined && wq.flow > 0);

      // Build upstream context: each incoming edge's source-node metadata, keyed by the edge's targetHandle id
      const upstreamContext: UpstreamContext = { nodeMetadata: {} };
      for (const e of incomingEdges) {
        const sourceResult = nodeResults.get(e.source);
        if (sourceResult?.metadata) {
          upstreamContext.nodeMetadata[e.targetHandle] = sourceResult.metadata;
        }
      }

      // Process
      const result = unit.process(inputs, upstreamContext);
      nodeResults.set(nodeId, result);

      // Distribute outputs to outgoing edges, grouped by source handle.
      // Recycle edges carry ratio × Q_basis (fixed flow, source concentrations).
      // Forward edges from the same handle are tapped: flow = sourceOut.flow − Σ recycle flows.
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      const handles = new Set(outgoingEdges.map(e => e.sourceHandle));
      for (const handle of handles) {
        const outputWQ = result.outputs[handle];
        if (!outputWQ) continue;

        const handleEdges = outgoingEdges.filter(e => e.sourceHandle === handle);
        const recycleOut = handleEdges.filter(e => recycleEdgeIds.has(e.id));
        const forwardOut = handleEdges.filter(e => !recycleEdgeIds.has(e.id));

        let totalRecycleFlow = 0;
        for (const re of recycleOut) {
          const recycleFlow = (re.recycleRatio ?? 4) * Q_basis;
          totalRecycleFlow += recycleFlow;
          edgeState.set(re.id, { ...outputWQ, flow: recycleFlow });
        }

        for (const fe of forwardOut) {
          edgeState.set(fe.id, { ...outputWQ, flow: Math.max(0, outputWQ.flow - totalRecycleFlow) });
        }

        if (totalRecycleFlow > outputWQ.flow + 1e-6) {
          (result.warnings ??= []).push(`Recycle ratio exceeds available flow at handle ${handle}`);
        }
      }
    }

    // Check convergence of recycle streams
    if (recycleEdges.length === 0) {
      converged = true;
      break;
    }

    converged = true;
    for (const re of recycleEdges) {
      const prev = prevRecycleValues.get(re.id)!;
      const curr = edgeState.get(re.id)!;

      // Check key parameters for convergence
      const params: (keyof WaterQuality)[] = ['flow', 'TSS', 'NO3N', 'NH3N', 'COD'];
      for (const param of params) {
        const prevVal = prev[param] as number;
        const currVal = curr[param] as number;
        if (prevVal === 0 && currVal === 0) continue;
        const denom = Math.max(Math.abs(prevVal), Math.abs(currVal), 1);
        const relChange = Math.abs(currVal - prevVal) / denom;
        if (relChange > CONVERGENCE_TOLERANCE) {
          converged = false;
          break;
        }
      }
      if (!converged) break;
    }

    if (converged) break;
  }

  // Calculate mass balance error (COD in vs COD out)
  const influentNodes = nodes.filter(n => (n.data as unknown as NodeData).unitType === 'influent');
  const effluentNodes = nodes.filter(n => (n.data as unknown as NodeData).unitType === 'effluent');

  let totalCODIn = 0;
  for (const inf of influentNodes) {
    const result = nodeResults.get(inf.id);
    if (result) {
      const outWQ = Object.values(result.outputs)[0];
      if (outWQ) totalCODIn += outWQ.COD * outWQ.flow;
    }
  }

  let totalCODOut = 0;
  for (const eff of effluentNodes) {
    const incomingEdges = edges.filter(e => e.target === eff.id);
    for (const e of incomingEdges) {
      const wq = edgeState.get(e.id);
      if (wq) totalCODOut += wq.COD * wq.flow;
    }
  }

  const massBalanceError = totalCODIn > 0 ? Math.abs(totalCODIn - totalCODOut) / totalCODIn : 0;

  // Build results
  const finalNodeResults: Record<string, ProcessResult> = {};
  for (const [id, result] of nodeResults) {
    finalNodeResults[id] = result;
  }

  const finalEdgeResults: Record<string, WaterQuality> = {};
  for (const [id, wq] of edgeState) {
    finalEdgeResults[id] = wq;
  }

  return {
    nodeResults: finalNodeResults,
    edgeResults: finalEdgeResults,
    converged,
    iterations: iteration,
    massBalanceError,
  };
}
