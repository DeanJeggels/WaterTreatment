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
