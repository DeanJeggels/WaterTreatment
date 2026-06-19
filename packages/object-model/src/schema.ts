/**
 * Zod schemas mirroring the EngineeringObject / DesignPackage type model. This
 * is the published contract every downstream tool (3D, BIM/CAD, exports) pins
 * to. Validation happens here, NOT in calc code — the schema enforces structure
 * and the class↔params coherence invariant that §3 keeps off the TS type.
 *
 * Pure + deterministic: no clocks, no randomness, no network, no LLM.
 */
import { z } from 'zod';
import { SCHEMA_VERSION } from './types';
import type {
  EngineeringObject,
  ObjectClass,
  ObjectParamsKind,
} from './types';
import type { DesignPackage } from './design-package';

const dimensionSchema = z.object({ value: z.number(), unit: z.string() });

const calculationRecordSchema = z.object({
  label: z.string(),
  symbol: z.string(),
  equation: z.string(),
  inputs: z.record(z.string(), z.object({ value: z.number(), unit: z.string(), source: z.string() })),
  result: z.object({ value: z.number(), unit: z.string() }),
  citation: z.string(),
});

const point2dSchema = z.object({ x: z.number(), y: z.number() });
const vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const coordinateSystemSchema = z.object({
  convention: z.literal('right-handed-z-up'),
  linearUnit: z.literal('m'),
  angleUnit: z.literal('deg'),
  origin: z.object({
    description: z.string(),
    crs: z.string().optional(),
    eastingM: z.number().optional(),
    northingM: z.number().optional(),
    groundLevelMamsl: z.number().optional(),
  }),
});

const objectClassSchema = z.enum([
  'tank', 'reactor', 'clarifier', 'membrane', 'pump', 'blower', 'screen', 'mixer',
  'dosing_skid', 'thickener', 'dewatering', 'disinfection', 'building',
  'electrical_room', 'access_zone', 'equipment',
]);

const disciplineSchema = z.enum([
  'process', 'mechanical', 'civil', 'electrical', 'instrumentation', 'access', 'piping',
]);

const connectionMediumSchema = z.enum(['water', 'sludge', 'air', 'chemical', 'power', 'signal']);

const geometrySchema = z.object({
  shape: z.enum(['rectangle', 'circle', 'polygon']),
  footprint: z.object({ lengthM: z.number(), widthM: z.number() }),
  diameterM: dimensionSchema.optional(),
  heightM: dimensionSchema.optional(),
  freeboardM: dimensionSchema.optional(),
  capacity: dimensionSchema.optional(),
  vertices: z.array(point2dSchema).optional(),
});

const placementSchema = z.object({
  location: vec3Schema,
  rotationDeg: z.number(),
  zone: z.enum(['process', 'sludge', 'chemical', 'electrical', 'blower', 'headworks']).optional(),
});

const portSchema = z.object({
  id: z.string(),
  role: z.enum(['inlet', 'outlet', 'recycle', 'waste', 'air', 'chemical', 'power', 'signal']),
  localOffset: vec3Schema,
  nominalBoreMm: dimensionSchema.optional(),
});

const sourceCalcSchema = z.object({
  flowsheetId: z.string(),
  nodeId: z.string(),
  // UnitType — kept as string to avoid drifting from sim-engine's union.
  unitType: z.string(),
  sizingKeys: z.array(z.string()),
  records: z.array(calculationRecordSchema),
  calcRevision: z.string().optional(),
});

// ---- ObjectParams discriminated union ----

const tankParamsSchema = z.object({
  kind: z.literal('tank'),
  function: z.enum([
    'equalisation', 'anoxic', 'aeration', 'anaerobic', 'clarifier', 'mbr',
    'sludge-holding', 'buffer', 'contact',
  ]),
  volumeM3: dimensionSchema,
  sideWaterDepthM: dimensionSchema,
  freeboardM: dimensionSchema.optional(),
  invertLevelM: dimensionSchema.optional(),
  topWaterLevelM: dimensionSchema.optional(),
  hydraulicRetentionTimeH: dimensionSchema.optional(),
  mlssMgL: dimensionSchema.optional(),
  diffuserCount: z.number().optional(),
  surfaceLoadingRateM3M2H: dimensionSchema.optional(),
  bunded: z.boolean().optional(),
});

const pumpParamsSchema = z.object({
  kind: z.literal('pump'),
  service: z.enum(['inlet', 'RAS', 'WAS', 'transfer', 'sludge', 'permeate', 'dosing']),
  pumpType: z.enum(['centrifugal', 'submersible', 'progressive-cavity', 'diaphragm', 'screw']),
  dutyFlowM3H: dimensionSchema,
  headM: dimensionSchema,
  installedKW: dimensionSchema,
  configuration: z.string(),
  standbyCount: z.number().optional(),
  vfd: z.boolean().optional(),
});

const blowerParamsSchema = z.object({
  kind: z.literal('blower'),
  blowerType: z.enum(['positive-displacement', 'hst-turbo', 'centrifugal', 'multistage']),
  airFlowAm3H: dimensionSchema,
  dischargePressureKpa: dimensionSchema,
  installedKW: dimensionSchema,
  configuration: z.string(),
  vfd: z.boolean().optional(),
});

const screenParamsSchema = z.object({
  kind: z.literal('screen'),
  screenType: z.enum(['coarse', 'fine', 'band', 'step', 'drum']),
  apertureMm: dimensionSchema,
  channelWidthM: dimensionSchema.optional(),
  designFlowM3H: dimensionSchema.optional(),
  installedKW: dimensionSchema.optional(),
  configuration: z.string().optional(),
});

const dosingSkidParamsSchema = z.object({
  kind: z.literal('dosing_skid'),
  chemical: z.enum([
    'alum', 'ferric-chloride', 'cationic-polymer', 'hydrated-lime', 'caustic-soda', 'sodium-hypochlorite',
  ]),
  doseMgL: dimensionSchema,
  dailyConsumptionKg: dimensionSchema,
  storageDays: dimensionSchema,
  storageTankVolumeM3: dimensionSchema,
  meteringPumps: z.object({ duty: z.number(), standby: z.number(), pumpType: z.string() }),
  bunded: z.literal(true),
  bundVolumeM3: dimensionSchema.optional(),
});

const genericEquipmentParamsSchema = z.object({
  kind: z.literal('equipment'),
  equipmentType: z.enum([
    'fine-screen', 'grit-classifier', 'mbr-cassette', 'belt-thickener', 'centrifuge',
    'uv-channel', 'mixer', 'scraper-bridge', 'penstock', 'clarifier-mechanism', 'other',
  ]),
  capacity: dimensionSchema.optional(),
  installedKW: dimensionSchema.optional(),
  configuration: z.string().optional(),
});

export const objectParamsSchema = z.discriminatedUnion('kind', [
  tankParamsSchema,
  pumpParamsSchema,
  blowerParamsSchema,
  screenParamsSchema,
  dosingSkidParamsSchema,
  genericEquipmentParamsSchema,
]);

const materialSpecSchema = z.object({
  primary: z.string(),
  grade: z.string().optional(),
  coating: z.string().optional(),
});

const objectConnectionSchema = z.object({
  toObjectId: z.string(),
  toPort: z.string(),
  medium: connectionMediumSchema,
});

/**
 * Coherence invariant: a "specific" params.kind locks the object's class to a
 * compatible set. The 'equipment' catch-all attaches to any class (no rule).
 * This is what makes a class/params mismatch fail at parse time.
 */
const SPECIFIC_KIND_CLASSES: Partial<Record<ObjectParamsKind, ObjectClass[]>> = {
  tank: ['tank', 'reactor', 'clarifier', 'membrane'],
  pump: ['pump'],
  blower: ['blower'],
  screen: ['screen'],
  dosing_skid: ['dosing_skid'],
};

const nozzleSchema = z.object({
  id: z.string(),
  service: z.string(),
  sizeMm: z.number(),
  face: z.enum(['upstream', 'downstream', 'top', 'bottom', 'side']),
  elevationMm: z.number(),
  flangeStandard: z.string(),
});
const maintenanceClearanceSchema = z.object({ N_mm: z.number(), S_mm: z.number(), E_mm: z.number(), W_mm: z.number() });
const standardsCheckSchema = z.object({ check: z.string(), status: z.enum(['pass', 'warn', 'fail']), note: z.string().optional() });
const mechanicalDetailSchema = z.object({
  equipmentId: z.string(),
  vendor: z.string(),
  model: z.string(),
  dutyStandby: z.object({ duty: z.number(), standby: z.number(), configuration: z.string() }),
  dimensionsMm: z.object({
    lengthMm: z.number().optional(),
    widthMm: z.number().optional(),
    heightMm: z.number().optional(),
    diameterMm: z.number().optional(),
    wallThicknessMm: z.number().optional(),
    weightKg: z.number().optional(),
  }),
  nozzles: z.array(nozzleSchema),
  accessories: z.array(z.string()),
  clearance: maintenanceClearanceSchema,
  standardsCompliance: z.array(standardsCheckSchema),
});

export const engineeringObjectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string(),
    tag: z.string(),
    class: objectClassSchema,
    discipline: disciplineSchema,
    label: z.string(),
    geometry: geometrySchema,
    placement: placementSchema,
    material: materialSpecSchema,
    capacity: z.record(z.string(), dimensionSchema),
    params: objectParamsSchema,
    ports: z.array(portSchema),
    connections: z.array(objectConnectionSchema),
    designNotes: z.array(z.string()),
    sourceCalc: sourceCalcSchema.optional(),
    mechanical: mechanicalDetailSchema.optional(),
    ext: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((obj, ctx) => {
    const allowed = SPECIFIC_KIND_CLASSES[obj.params.kind];
    if (allowed && !allowed.includes(obj.class)) {
      ctx.addIssue({
        code: 'custom',
        message: `params.kind '${obj.params.kind}' is not valid for class '${obj.class}'`,
        path: ['params', 'kind'],
      });
    }
  });

// ---- DesignPackage ----

const corridorSchema = z.object({
  id: z.string(),
  kind: z.enum(['maintenance', 'vehicle']),
  widthM: z.number(),
  polygon: z.array(point2dSchema),
});

const bundSchema = z.object({
  id: z.string(),
  servesObjectId: z.string(),
  capacityM3: z.number(),
  polygon: z.array(point2dSchema),
});

const pipeRouteSchema = z.object({
  id: z.string(),
  fromObjectId: z.string(),
  fromPort: z.string(),
  toObjectId: z.string(),
  toPort: z.string(),
  medium: connectionMediumSchema,
  points: z.array(point2dSchema),
});

const layoutViolationSchema = z.object({
  code: z.string(),
  message: z.string(),
  objectIds: z.array(z.string()).optional(),
  severity: z.enum(['error', 'warning']),
});

const ruleApplicationSchema = z.object({
  rule: z.string(),
  objectId: z.string().optional(),
  detail: z.string().optional(),
});

export const plantLayoutSchema = z.object({
  siteBoundary: z.array(point2dSchema),
  corridors: z.array(corridorSchema),
  bunds: z.array(bundSchema),
  pipeRoutes: z.array(pipeRouteSchema),
  violations: z.array(layoutViolationSchema),
  rulesApplied: z.array(ruleApplicationSchema),
});

const designPackageMetaSchema = z.object({
  projectId: z.string(),
  flowsheetId: z.string(),
  projectName: z.string(),
  client: z.string().optional(),
  siteLocation: z.string().optional(),
  plantType: z.string(),
  generatedAt: z.string(),
  engine: z.object({ simEngine: z.string(), layout: z.string() }),
});

const designBasisSchema = z.object({
  dischargeStandard: z.record(z.string(), z.unknown()),
  influentBasis: z.record(z.string(), z.number()),
  designFlows: z.record(z.string(), z.number()),
});

const packageGraphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      unitType: z.string(),
      label: z.string().optional(),
      parameters: z.record(z.string(), z.number()).optional(),
      position: point2dSchema.optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string().optional(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
    }),
  ),
});

const packageBoQSchema = z.object({
  grandTotalZar: z.number(),
  lineItemsByCategory: z.record(z.string(), z.array(z.unknown())),
});

const packageComplianceSchema = z.object({
  standard: z.string(),
  pass: z.boolean(),
  perParameter: z.record(
    z.string(),
    z.object({ target: z.number(), predicted: z.number(), pass: z.boolean() }),
  ),
});

const packageTotalsSchema = z.object({
  capexZar: z.number(),
  installedKW: z.number(),
  footprintM2: z.number(),
});

const packageProvenanceSchema = z.object({
  calculations: z.array(calculationRecordSchema),
  layoutRules: z.string(),
});

export const designPackageSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  meta: designPackageMetaSchema,
  coordinateSystem: coordinateSystemSchema,
  inputs: z.record(z.string(), z.unknown()),
  basis: designBasisSchema,
  graph: packageGraphSchema,
  objects: z.array(engineeringObjectSchema),
  layout: plantLayoutSchema,
  boq: packageBoQSchema,
  compliance: packageComplianceSchema,
  totals: packageTotalsSchema,
  provenance: packageProvenanceSchema,
  mleMbr: z.record(z.string(), z.unknown()).optional(),
  layoutOptions: z.array(z.record(z.string(), z.unknown())).optional(),
  modelJson: z.record(z.string(), z.unknown()).optional(),
});

/** Parse + validate an unknown value into an EngineeringObject (throws on invalid). */
export function parseEngineeringObject(input: unknown): EngineeringObject {
  return engineeringObjectSchema.parse(input) as EngineeringObject;
}

/** Parse + validate an unknown value into a DesignPackage (throws on invalid). */
export function parseDesignPackage(input: unknown): DesignPackage {
  return designPackageSchema.parse(input) as DesignPackage;
}

/** Non-throwing variant — returns zod's SafeParseReturnType. */
export function safeParseDesignPackage(input: unknown) {
  return designPackageSchema.safeParse(input);
}
