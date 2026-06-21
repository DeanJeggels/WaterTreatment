// Types
export type {
  WaterQuality,
  Stream,
  ProcessResult,
  ProcessUnit,
  HandleDef,
  UnitDefinition,
  ParameterField,
  UnitType,
  DischargeStandards,
  SimulationResults,
} from './types';

export { emptyWaterQuality, mixStreams } from './types';

// v2 types (new for proposal generator)
export type {
  Dimension,
  CalculationRecord,
  BoQLineItem,
  BoQCategory,
  ConsumableItem,
  UnitOutputs,
  PlantContext,
} from './types';
export {
  isValidCalculationRecord,
  BOQ_CATEGORIES,
  isValidBoQLineItem,
  emptyUnitOutputs,
  defaultPlantContext,
} from './types';

// Unit models and registry
export {
  unitDefinitions,
  createUnit,
  Influent,
  PrimaryClarifier,
  BioreactorAerobic,
  BioreactorAnoxic,
  BioreactorAnaerobic,
  SecondaryClarifier,
  Splitter,
  Mixer,
  Thickener,
  Effluent,
  checkCompliance,
} from './units/index';

// Graph simulation
export { simulate } from './graph/simulator';
export { topologicalSort } from './graph/topological-sort';
export type { GraphNode, GraphEdge } from './graph/topological-sort';

// Plant-wide mass-balance ledger (Phase 2 acceptance) + MLE/MBR train delegate
export { computeMassBalanceLedger } from './graph/mass-balance';
export type { ComponentBalance, NodeLedger, PlantClosure, MassBalanceLedger } from './graph/mass-balance';
export { recogniseMleTrain, basisFromTrain, delegateMleDesign } from './graph/recognise-mle-train';
export type { RecognisedTrain, TrainBasisOverrides } from './graph/recognise-mle-train';

// Headless plant-evaluation engine (Phase 3 seam for the optimizer)
export { evaluatePlant } from './engine/evaluate';
export type { GraphDefinition, EvaluateOptions, PlantEvaluation } from './engine/evaluate';

// NSGA-II topology + sizing optimizer (Phase 4)
export { optimizePlant } from './optimize/nsga2';
export type { OptimizeOptions, OptimizeResult, ParetoPoint } from './optimize/nsga2';
export { decodeVars, decodeToGraph, GENOME_LENGTH } from './optimize/genome';
export type { OptimizerSpec, DecisionVars } from './optimize/genome';
export { evaluateObjectives } from './optimize/objectives';
export type { Objectives } from './optimize/objectives';

import { topologicalSort as _topologicalSort } from './graph/topological-sort';
import type { GraphNode as _GraphNode, GraphEdge as _GraphEdge } from './graph/topological-sort';

/**
 * Flag the recycle (back-)edges in a flowsheet, using the same topological-sort
 * detection the simulator relies on. Lets the UI mark recycle lines identically.
 */
export function detectRecycleEdges(nodes: _GraphNode[], edges: _GraphEdge[]): _GraphEdge[] {
  return _topologicalSort(nodes, edges).recycleEdges;
}

// MLE-MBR preliminary design engine (deterministic Marais-Ekama replication)
export { designMleMbr } from './design/mle-mbr';
export type {
  MleMbrBasis,
  MleMbrConstants,
  MleMbrDesign,
  DischargeStandard,
  MembraneModel,
  LandUse,
  ProcessConfig,
  DerivedInfluent,
  CodFractionation,
  FlowSet,
  TankOption,
  SizedTank,
} from './design/mle-mbr';

// Shared engineering kernels (single source of truth, used by both the
// MLE-MBR design generator and the flowsheet block models)
export * from './kernels';

// BoQ engine
export { aggregateBoQ } from './boq/aggregator';
export type {
  FlowsheetNodeLite,
  BoQOverride,
  AggregatedBoQ,
} from './boq/aggregator';
