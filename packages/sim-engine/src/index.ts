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
