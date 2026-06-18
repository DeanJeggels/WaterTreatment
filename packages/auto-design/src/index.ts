// @repo/auto-design — orchestration: validate -> selectTrain -> buildGraph ->
// simulate -> aggregateBoQ -> instantiateObjects -> layout -> assemblePackage.
// Headless, deterministic, LLM-free. All engineering numbers come from
// @repo/sim-engine; this package only sequences and shapes them.

export type {
  PlantType,
  DischargeTier,
  ProjectMeta,
  InfluentQuality,
  DesignPreferences,
  DesignInputs,
} from './inputs';
export { defaultInputs } from './inputs';

export type { ValidationError, ValidationResult } from './validate';
export { validateInputs } from './validate';

export type { TrainOptions, ProcessTopology } from './select-train';
export { selectTrain } from './select-train';

export type {
  AutoDesignNode,
  AutoDesignNodeData,
  AutoDesignEdge,
  FlowsheetGraph,
} from './build-graph';
export { buildGraph, toFlowsheetNodeLites } from './build-graph';

export type { ComplianceResult, AutoDesignRunResult, RunOptions } from './run';
export { runAutoDesign, AutoDesignValidationError } from './run';

export type { AssembleMeta } from './assemble';
export { assembleDesignPackage } from './assemble';
