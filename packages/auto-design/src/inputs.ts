/**
 * DesignInputs — the form entered ONCE that drives the whole auto-design
 * pipeline. Pure data + a deterministic `defaultInputs(tier)` preset seeded from
 * @repo/design-library (SA_TYPICAL_INFLUENT + getDwaLimits). No clocks, no
 * randomness, no AI.
 */
import { SA_TYPICAL_INFLUENT, getDwaLimits, type DwaDischargeStandard } from '@repo/design-library';
import type { MembraneModel, LandUse } from '@repo/sim-engine';

/** MVP ships the MLE train; the rest are Phase 2 (kept for type-completeness). */
export type PlantType = 'MLE' | 'MBR' | 'extended_aeration' | 'conventional_as';

export type DischargeTier = 'General' | 'Special';

export interface ProjectMeta {
  projectName: string;
  client?: string;
  siteLocation?: string;
}

/** Influent quality vector — a subset of sim-engine WaterQuality the form collects. */
export interface InfluentQuality {
  /** mg/L total COD. */
  COD: number;
  /** mg/L soluble (0.45 μm filtered) COD. */
  sCOD: number;
  /** mg/L BOD5 (optional; estimated from COD if absent). */
  BOD5?: number;
  /** mgN/L total Kjeldahl nitrogen. */
  TKN: number;
  /** mgN/L free & saline ammonia. */
  NH3N: number;
  /** mgP/L total phosphorus. */
  TP: number;
  /** mg/L total suspended solids. */
  TSS: number;
  /** mg/L volatile suspended solids (optional). */
  VSS?: number;
  /** mg/L as CaCO3. */
  alkalinity?: number;
  pH?: number;
  /** °C — design (winter) temperature drives kinetics. */
  temperature?: number;
}

export interface DesignPreferences {
  /** Add chemical P-removal dosing (ferric) when influent TP exceeds the target. */
  pRemoval: boolean;
  /** Add UV disinfection as the tertiary step. */
  disinfection: boolean;
}

export interface DesignInputs {
  meta: ProjectMeta;
  /** Average dry-weather design flow, m³/d. */
  designFlowM3d: number;
  /** Peak wet-weather factor (PWWF / ADWF), ≥ 1. */
  peakFactor: number;
  influent: InfluentQuality;
  dischargeStandard: DischargeTier;
  /** Resolved effluent limits for the tier (echoed for replay/audit). */
  effluentTargets: DwaDischargeStandard;
  /** Available site area, m². */
  siteAreaM2: number;
  /** Optional surveyed site boundary polygon, metres (site-local coords). */
  siteBoundary?: Array<{ x: number; y: number }>;
  plantType: PlantType;
  preferences: DesignPreferences;
}

/**
 * Deterministic preset. Influent is seeded from SA_TYPICAL_INFLUENT and the
 * effluent targets from getDwaLimits(tier) (REUSED verbatim). The user always
 * overrides flow/quality; this just gives a sane, replayable starting point.
 */
export function defaultInputs(tier: DischargeTier = 'General'): DesignInputs {
  const inf = SA_TYPICAL_INFLUENT;
  const limits = getDwaLimits(tier);
  return {
    meta: { projectName: '' },
    designFlowM3d: 10000,
    peakFactor: 2.5,
    influent: {
      COD: inf.COD,
      sCOD: inf.CODfiltered,
      TKN: inf.TKN,
      NH3N: inf.FSA,
      TP: inf.TP,
      TSS: inf.TSS,
      alkalinity: inf.alkalinity,
      pH: inf.pH,
      temperature: 20,
    },
    dischargeStandard: tier,
    effluentTargets: limits,
    // ~3 ha — comfortably fits a preliminary MLE plant at the default flow; the
    // plant is long+thin (~180 m), so an undersized square plot is the common
    // cause of a 'site_area_exceeded' violation. Users set their real area.
    siteAreaM2: 30000,
    plantType: 'MLE',
    // P-removal recommended when raw TP exceeds the discharge target.
    preferences: {
      pRemoval: limits.TP !== undefined ? inf.TP > limits.TP : false,
      disinfection: true,
    },
  };
}

// ---------------------------------------------------------------------------
// MLE-MBR design inputs (the redesigned form — the system is now MLE-MBR)
// ---------------------------------------------------------------------------

// ---- Stage 1 configuration inputs (master spec) ----
export type InstallationType =
  | 'underground_civil'
  | 'above_ground_civil'
  | 'container_20ft'
  | 'container_40ft'
  | 'container_twin_20ft'
  | 'open_frame_skid';
export type NumberOfTrains = 'single' | 'dual' | 'multiple';
export type MaintenanceAccess = 'standard' | 'full';
export type TankPlacement = 'above_ground' | 'in_ground';
export type ClientPriority = 'lowest_cost' | 'best_access' | 'smallest_footprint' | 'future_expansion';

/** The small input set for the MLE-MBR design (everything else is derived). */
export interface MleMbrInputs {
  meta: ProjectMeta;
  // --- process inputs ---
  /** Average dry-weather flow, m³/d. */
  adwfM3d: number;
  /** Raw influent total COD, mg/L (all other influent quality is derived). */
  codMgL: number;
  tminC: number;
  tmaxC: number;
  elevationM: number;
  nitrogenRemoval: boolean;
  phosphorusRemoval: boolean;
  dischargeStandard: DischargeTier;
  mbrRequired: boolean;
  membraneModel: MembraneModel;
  landUse: LandUse;
  // --- Stage 1 configuration inputs ---
  installationType: InstallationType;
  /** Available site footprint, metres. */
  footprintLengthM: number;
  footprintWidthM: number;
  numberOfTrains: NumberOfTrains;
  maintenanceAccess: MaintenanceAccess;
  tankPlacement: TankPlacement;
  containerStacking: boolean;
  clientPriority: ClientPriority;
  siteBoundary?: Array<{ x: number; y: number }>;
}

export function defaultMleMbrInputs(): MleMbrInputs {
  return {
    meta: { projectName: '' },
    adwfM3d: 70,
    codMgL: 900,
    tminC: 15,
    tmaxC: 25,
    elevationM: 1700,
    nitrogenRemoval: true,
    phosphorusRemoval: false,
    dischargeStandard: 'Special',
    mbrRequired: true,
    membraneModel: 'megavision',
    landUse: 'residential',
    installationType: 'above_ground_civil',
    footprintLengthM: 80,
    footprintWidthM: 60,
    numberOfTrains: 'single',
    maintenanceAccess: 'standard',
    tankPlacement: 'above_ground',
    containerStacking: false,
    clientPriority: 'best_access',
  };
}
