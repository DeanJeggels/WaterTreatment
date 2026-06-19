// Types
export type {
  WaterQuality,
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

// BoQ engine
export { aggregateBoQ } from './boq/aggregator';
export type {
  FlowsheetNodeLite,
  BoQOverride,
  AggregatedBoQ,
} from './boq/aggregator';
