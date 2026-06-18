// @repo/object-model — the EngineeringObject / DesignPackage spatial model.
// Headless, deterministic, LLM-free. Depends only on @repo/sim-engine types
// (+ zod for the published validation contract).

export { SCHEMA_VERSION } from './types';
export type {
  SchemaVersion,
  ObjectClass,
  Discipline,
  Geometry,
  Placement,
  Port,
  SourceCalc,
  ConnectionMedium,
  ObjectConnection,
  MaterialSpec,
  TankParams,
  PumpParams,
  BlowerParams,
  ScreenParams,
  DosingSkidParams,
  GenericEquipmentParams,
  ObjectParams,
  ObjectParamsKind,
  EngineeringObject,
  Dimension,
  CalculationRecord,
  UnitType,
} from './types';

export { siteLocalCoordinateSystem } from './coordinate-system';
export type { CoordinateSystem } from './coordinate-system';

export { deriveGeometry } from './dimension-deriver';
export type { DerivedGeometry } from './dimension-deriver';

export { allocateTag, processAreaFor } from './tags';
export { materialFor } from './materials';

export { instantiateObjects } from './materialise';
export type { MaterialiserNode, MaterialiserEdge, MaterialiseOptions } from './materialise';

export { instantiateMleMbr } from './mle-mbr-objects';
export type { MleMbrInstantiateOptions } from './mle-mbr-objects';

export type {
  Point2D,
  Corridor,
  Bund,
  PipeRoute,
  LayoutViolation,
  RuleApplication,
  PlantLayout,
  DesignPackageMeta,
  DesignBasis,
  PackageGraphNode,
  PackageGraphEdge,
  PackageGraph,
  PackageBoQ,
  PackageComplianceParameter,
  PackageCompliance,
  PackageTotals,
  PackageProvenance,
  DesignPackage,
} from './design-package';

export {
  coordinateSystemSchema,
  objectParamsSchema,
  engineeringObjectSchema,
  plantLayoutSchema,
  designPackageSchema,
  parseEngineeringObject,
  parseDesignPackage,
  safeParseDesignPackage,
} from './schema';

export { designPackageJSONSchema } from './json-schema';
