/**
 * runAutoDesign — the orchestration spine (stages 1–5 here; objects + layout +
 * assemble are wired in later phases). Every engineering number comes from
 * @repo/sim-engine; this file only sequences and shapes them. Pure, deterministic
 * (same DesignInputs -> byte-identical results), no LLM, no network.
 */
import {
  simulate,
  aggregateBoQ,
  checkCompliance,
  type SimulationResults,
  type AggregatedBoQ,
  type WaterQuality,
  type DischargeStandards,
} from '@repo/sim-engine';
import type { DesignInputs } from './inputs';
import { validateInputs, type ValidationError } from './validate';
import { selectTrain, type ProcessTopology } from './select-train';
import { buildGraph, toFlowsheetNodeLites, type FlowsheetGraph } from './build-graph';

export class AutoDesignValidationError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Invalid design inputs: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`);
    this.name = 'AutoDesignValidationError';
  }
}

export interface ComplianceResult {
  standard: string;
  pass: boolean;
  perParameter: Record<string, { value: number; limit: number; pass: boolean }>;
}

export interface AutoDesignRunResult {
  inputs: DesignInputs;
  topology: ProcessTopology;
  graph: FlowsheetGraph;
  results: SimulationResults;
  boq: AggregatedBoQ;
  compliance: ComplianceResult;
}

function toDischargeStandards(input: DesignInputs): DischargeStandards {
  const t = input.effluentTargets;
  return {
    COD: t.COD,
    BOD5: t.BOD5,
    NH3N: t.NH3N,
    NO3N: t.NO3N,
    TSS: t.TSS,
    TP: t.TP,
    pH_min: t.pH_min,
    pH_max: t.pH_max,
  };
}

/** The effluent quality is the water on the edge feeding the effluent node. */
function effluentQuality(graph: FlowsheetGraph, results: SimulationResults): WaterQuality | undefined {
  const effluentNode = graph.nodes.find((n) => n.data.unitType === 'effluent');
  if (!effluentNode) return undefined;
  const inboundEdge = graph.edges.find((e) => e.target === effluentNode.id);
  return inboundEdge ? results.edgeResults[inboundEdge.id] : undefined;
}

/**
 * Stages 1–5: validate -> selectTrain -> buildGraph -> simulate -> aggregateBoQ
 * + checkCompliance. Throws AutoDesignValidationError on invalid inputs.
 */
export function runAutoDesign(input: DesignInputs): AutoDesignRunResult {
  // [1] validate
  const validation = validateInputs(input);
  if (!validation.valid) throw new AutoDesignValidationError(validation.errors);

  // [2] select train
  const topology = selectTrain({
    plantType: input.plantType,
    pRemoval: input.preferences.pRemoval,
    disinfection: input.preferences.disinfection,
  });

  // [3] build graph
  const graph = buildGraph(topology, input);

  // [4] simulate — REUSED sim-engine, THE MATH
  const results = simulate(graph.nodes, graph.edges);

  // [5] BoQ + compliance — REUSED
  const boq = aggregateBoQ(toFlowsheetNodeLites(graph), results.nodeResults);

  const standards = toDischargeStandards(input);
  const effluent = effluentQuality(graph, results);
  const perParameter = effluent ? checkCompliance(effluent, standards) : {};
  const pass = Object.values(perParameter).every((p) => p.pass);

  return {
    inputs: input,
    topology,
    graph,
    results,
    boq,
    compliance: { standard: input.dischargeStandard, pass, perParameter },
  };
}
