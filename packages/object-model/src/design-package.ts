/**
 * DesignPackage — the persisted, versioned root and the SOURCE OF TRUTH for
 * every downstream export (JSON canonical; PDF/Excel are lossy projections of
 * the SAME package). Canonical shape: "AquaSim v3 — MVP Architecture" §6.
 *
 * object-model is the lowest layer (depends only on sim-engine), so it owns the
 * spatial DATA types — including the {@link PlantLayout} shape that the
 * layout-engine produces and the package blocks the assembler fills. The
 * cross-package payloads `inputs`/`basis`/`graph`/`boq`/`compliance` are typed
 * structurally here (their producing logic lives in auto-design / sim-engine);
 * no logic is imported, so the dependency graph stays acyclic.
 */
import type { Dimension, CalculationRecord } from '@repo/sim-engine';
import type { CoordinateSystem } from './coordinate-system';
import type { EngineeringObject, ConnectionMedium, SchemaVersion } from './types';

export interface Point2D {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// PlantLayout — written by @repo/layout-engine, carried verbatim in the package
// ---------------------------------------------------------------------------

export interface Corridor {
  id: string;
  kind: 'maintenance' | 'vehicle';
  widthM: number;
  polygon: Point2D[];
}

export interface Bund {
  id: string;
  servesObjectId: string;
  capacityM3: number;
  polygon: Point2D[];
}

export interface PipeRoute {
  id: string;
  fromObjectId: string;
  fromPort: string;
  toObjectId: string;
  toPort: string;
  medium: ConnectionMedium;
  /** Orthogonal (Manhattan) polyline in site coords, metres. */
  points: Point2D[];
}

export interface LayoutViolation {
  code: string;
  message: string;
  objectIds?: string[];
  severity: 'error' | 'warning';
}

export interface RuleApplication {
  /** Names a rule in LAYOUT_RULES, e.g. "spacing.byClass.clarifier". */
  rule: string;
  objectId?: string;
  detail?: string;
}

export interface PlantLayout {
  /** Closed polygon, site CRS, metres. */
  siteBoundary: Point2D[];
  corridors: Corridor[];
  bunds: Bund[];
  pipeRoutes: PipeRoute[];
  violations: LayoutViolation[];
  rulesApplied: RuleApplication[];
}

// ---------------------------------------------------------------------------
// Package blocks
// ---------------------------------------------------------------------------

export interface DesignPackageMeta {
  projectId: string;
  flowsheetId: string;
  projectName: string;
  client?: string;
  siteLocation?: string;
  plantType: string;
  /** ISO timestamp — stamped by apps/web after the headless run returns. */
  generatedAt: string;
  engine: { simEngine: string; layout: string };
}

export interface DesignBasis {
  dischargeStandard: Record<string, unknown>;
  influentBasis: Record<string, number>;
  designFlows: Record<string, number>;
}

export interface PackageGraphNode {
  id: string;
  unitType: string;
  label?: string;
  parameters?: Record<string, number>;
  position?: Point2D;
}

export interface PackageGraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface PackageGraph {
  nodes: PackageGraphNode[];
  edges: PackageGraphEdge[];
}

export interface PackageBoQ {
  grandTotalZar: number;
  /** Mirrors sim-engine AggregatedBoQ.lineItemsByCategory (grouped, subtotalled). */
  lineItemsByCategory: Record<string, unknown[]>;
}

export interface PackageComplianceParameter {
  target: number;
  predicted: number;
  pass: boolean;
}

export interface PackageCompliance {
  standard: string;
  pass: boolean;
  perParameter: Record<string, PackageComplianceParameter>;
}

export interface PackageTotals {
  capexZar: number;
  installedKW: number;
  footprintM2: number;
}

export interface PackageProvenance {
  /** Every CalculationRecord across the run — the offline audit trail. */
  calculations: CalculationRecord[];
  /** The layout-rules provenance string, e.g. "CH-ISE v1". */
  layoutRules: string;
}

/** The persisted root. Every field is plain data — no logic, no clocks. */
export interface DesignPackage {
  schemaVersion: SchemaVersion;
  meta: DesignPackageMeta;
  coordinateSystem: CoordinateSystem;
  /** The form echoed verbatim — replayable / deterministic. */
  inputs: Record<string, unknown>;
  basis: DesignBasis;
  graph: PackageGraph;
  /** THE spatial source of truth. */
  objects: EngineeringObject[];
  layout: PlantLayout;
  boq: PackageBoQ;
  compliance: PackageCompliance;
  totals: PackageTotals;
  provenance: PackageProvenance;
  /** Full MLE-MBR design output (drives the 10-section report). Opaque here to
   *  avoid coupling object-model to the engine's design shape. */
  mleMbr?: Record<string, unknown>;
  /** Stage-5 layout-optimisation candidate summaries (top 3, selected flagged). */
  layoutOptions?: Array<Record<string, unknown>>;
}

/** Re-exported so downstream packages can pull this from `@repo/object-model`. */
export type { Dimension };
