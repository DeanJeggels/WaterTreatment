/**
 * EngineeringObject — the linchpin spatial model for AquaSim v3.
 *
 * One structured object per physical engineering item. The SAME instance drives
 * 2D layout, 3D, BoQ, equipment schedule, electrical load list, and JSON/CAD
 * export. It NEVER re-derives an engineering number: every sized magnitude is a
 * verbatim copy of a {@link Dimension} from `@repo/sim-engine`, and every object
 * carries a by-value link back to the {@link CalculationRecord}s that sized it.
 *
 * Authoritative shape: "AquaSim v3 — MVP Architecture" §3 (which reconciled the
 * "Engineering Object Schema" draft against the live repo and is authoritative
 * where the two differ). MVP param set only: tank/pump/blower/screen/dosing_skid/
 * equipment. valve/instrument/pipe params are deferred to Phase 2.
 */
import type { Dimension, CalculationRecord, UnitType } from '@repo/sim-engine';

export type { CoordinateSystem } from './coordinate-system';

/** Stamped on every object and package so old JSON can be migrated. */
export const SCHEMA_VERSION = '1.0.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** Top-level object class. Drives downstream class→IFC/material/BoQ mapping. */
export type ObjectClass =
  | 'tank'
  | 'reactor'
  | 'clarifier'
  | 'membrane'
  | 'pump'
  | 'blower'
  | 'screen'
  | 'mixer'
  | 'dosing_skid'
  | 'thickener'
  | 'dewatering'
  | 'disinfection'
  | 'building'
  | 'electrical_room'
  | 'access_zone'
  | 'equipment';

/** The discipline an object belongs to (drives filtering & overlays). */
export type Discipline =
  | 'process'
  | 'mechanical'
  | 'civil'
  | 'electrical'
  | 'instrumentation'
  | 'access'
  | 'piping';

/**
 * Footprint + envelope. The bounding `footprint` is ALWAYS present (the layout
 * engine packs collision boxes on it); circular units additionally carry
 * `diameterM`. Derived geometrically by the dimension-deriver (a layout
 * transform), never a re-derivation of a process quantity.
 */
export interface Geometry {
  shape: 'rectangle' | 'circle' | 'polygon';
  /** Bounding box — always present. metres. */
  footprint: { lengthM: number; widthM: number };
  /** Circular units (clarifier, thickener). */
  diameterM?: Dimension;
  /** Wall / water depth — drives 3D extrusion. */
  heightM?: Dimension;
  freeboardM?: Dimension;
  /** Hydraulic holding volume where meaningful. */
  capacity?: Dimension;
  /** Local, pre-rotation vertices for polygons. metres. */
  vertices?: Array<{ x: number; y: number }>;
}

/** Site placement — written ONLY by the layout engine (origin/0° until then). */
export interface Placement {
  /** Centroid/anchor on the site grid, metres. */
  location: { x: number; y: number; z: number };
  /** Plan rotation, degrees CCW. 0 = inlet faces +X. */
  rotationDeg: number;
  zone?: 'process' | 'sludge' | 'chemical' | 'electrical' | 'blower' | 'headworks';
}

/** A nozzle/connection point on an object. */
export interface Port {
  /** Matches the sim-engine HandleDef.id ('in','out','ras','air'…). */
  id: string;
  role: 'inlet' | 'outlet' | 'recycle' | 'waste' | 'air' | 'chemical' | 'power' | 'signal';
  /** Local offset from the object origin, metres, pre-rotation. */
  localOffset: { x: number; y: number; z: number };
  nominalBoreMm?: Dimension;
}

/**
 * Link back to the deterministic engine that SIZED this object. No geometry is
 * invented here — `records` are copied BY VALUE from sim-engine so the JSON
 * export is self-contained and offline-auditable.
 */
export interface SourceCalc {
  flowsheetId: string;
  /** React-Flow node id → `SimulationResults.nodeResults[nodeId]`. */
  nodeId: string;
  /** Denormalised for export. */
  unitType: UnitType;
  /** Literal keys into `nodeResults[id].sizing`, e.g. ['volume','depth','MLSS']. */
  sizingKeys: string[];
  /** Verbatim copy of the relevant `CalculationRecord`s (and energy.records). */
  records: CalculationRecord[];
  /** Hash of inputs → detect stale geometry against the latest sim run. */
  calcRevision?: string;
}

/** Medium carried by a connection between two objects. */
export type ConnectionMedium = 'water' | 'sludge' | 'air' | 'chemical' | 'power' | 'signal';

export interface ObjectConnection {
  toObjectId: string;
  toPort: string;
  medium: ConnectionMedium;
}

// ---------------------------------------------------------------------------
// Class-specific typed parameter blocks (the MVP `ObjectParams` union)
// ---------------------------------------------------------------------------

export interface TankParams {
  kind: 'tank';
  function:
    | 'equalisation'
    | 'anoxic'
    | 'aeration'
    | 'anaerobic'
    | 'clarifier'
    | 'mbr'
    | 'sludge-holding'
    | 'buffer'
    | 'contact';
  volumeM3: Dimension;
  sideWaterDepthM: Dimension;
  freeboardM?: Dimension;
  invertLevelM?: Dimension;
  topWaterLevelM?: Dimension;
  hydraulicRetentionTimeH?: Dimension;
  /** For biological tanks. */
  mlssMgL?: Dimension;
  /** For aeration tanks. */
  diffuserCount?: number;
  /** For clarifiers. */
  surfaceLoadingRateM3M2H?: Dimension;
  bunded?: boolean;
}

export interface PumpParams {
  kind: 'pump';
  service: 'inlet' | 'RAS' | 'WAS' | 'transfer' | 'sludge' | 'permeate' | 'dosing';
  pumpType: 'centrifugal' | 'submersible' | 'progressive-cavity' | 'diaphragm' | 'screw';
  dutyFlowM3H: Dimension;
  headM: Dimension;
  installedKW: Dimension;
  /** e.g. "2 duty + 1 standby". */
  configuration: string;
  standbyCount?: number;
  vfd?: boolean;
}

export interface BlowerParams {
  kind: 'blower';
  blowerType: 'positive-displacement' | 'hst-turbo' | 'centrifugal' | 'multistage';
  /** ← reads sizing.airFlow. */
  airFlowAm3H: Dimension;
  /** ← reads sizing.deltaP. */
  dischargePressureKpa: Dimension;
  /** ← reads energy.installedKW / sizing.blowerKW. */
  installedKW: Dimension;
  configuration: string;
  vfd?: boolean;
}

export interface ScreenParams {
  kind: 'screen';
  screenType: 'coarse' | 'fine' | 'band' | 'step' | 'drum';
  apertureMm: Dimension;
  channelWidthM?: Dimension;
  designFlowM3H?: Dimension;
  installedKW?: Dimension;
  configuration?: string;
}

export interface DosingSkidParams {
  kind: 'dosing_skid';
  chemical:
    | 'alum'
    | 'ferric-chloride'
    | 'cationic-polymer'
    | 'hydrated-lime'
    | 'caustic-soda'
    | 'sodium-hypochlorite';
  doseMgL: Dimension;
  /** ← reads sizing.dailyConsumption. */
  dailyConsumptionKg: Dimension;
  storageDays: Dimension;
  /** ← reads sizing.tankVolume. */
  storageTankVolumeM3: Dimension;
  meteringPumps: { duty: number; standby: number; pumpType: string };
  /** Chemical → always bunded (a layout-rule input). */
  bunded: true;
  /** ≥110% of the largest tank. */
  bundVolumeM3?: Dimension;
}

/**
 * Catch-all duty block for sized units without a dedicated MVP param type
 * (reactor, clarifier, membrane, mixer, thickener, dewatering, grit, UV…).
 */
export interface GenericEquipmentParams {
  kind: 'equipment';
  equipmentType:
    | 'fine-screen'
    | 'grit-classifier'
    | 'mbr-cassette'
    | 'belt-thickener'
    | 'centrifuge'
    | 'uv-channel'
    | 'mixer'
    | 'scraper-bridge'
    | 'penstock'
    | 'clarifier-mechanism'
    | 'other';
  capacity?: Dimension;
  installedKW?: Dimension;
  configuration?: string;
}

/** The typed parameter union — narrowed by `kind`. MVP set only. */
export type ObjectParams =
  | TankParams
  | PumpParams
  | BlowerParams
  | ScreenParams
  | DosingSkidParams
  | GenericEquipmentParams;

export type ObjectParamsKind = ObjectParams['kind'];

/** Material spec — typed enough to drive BoQ rate lookup + 3D appearance. */
export interface MaterialSpec {
  primary: string;
  grade?: string;
  coating?: string;
}

/**
 * THE spatial object. A single (non class-locked) interface per §3: `class` and
 * `params` are independent fields — the class↔params coherence invariant is
 * enforced at the zod/runtime layer (T0.3), not by the TypeScript type.
 */
export interface EngineeringObject {
  schemaVersion: SchemaVersion;
  /** Stable uuid — survives re-layout & re-run. */
  id: string;
  /** ISA-style tag, e.g. "BIO-2101-TK" (deterministic from area/class/seq). */
  tag: string;
  class: ObjectClass;
  discipline: Discipline;
  label: string;

  geometry: Geometry;
  /** (0,0,0)/0° until the layout engine runs. */
  placement: Placement;
  material: MaterialSpec;

  /** Verbatim copy of `nodeResults[id].sizing` — NO LOSS, never re-derived. */
  capacity: Record<string, Dimension>;
  params: ObjectParams;

  ports: Port[];
  connections: ObjectConnection[];

  /** From `UnitOutputs.warnings` + layout notes. */
  designNotes: string[];
  /** Omitted only for purely manual annotations. */
  sourceCalc?: SourceCalc;
  /** Forward-compat (BIM GUID, asset no.) — never load-bearing. */
  ext?: Record<string, unknown>;
}

/** Re-exported so downstream packages can pull these from `@repo/object-model`. */
export type { Dimension, CalculationRecord, UnitType };
