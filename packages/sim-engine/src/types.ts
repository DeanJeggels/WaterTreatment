import type { Dimension } from './types/dimension';
import type { CalculationRecord } from './types/calculation-record';
import type { BoQLineItem } from './types/boq-line-item';
import type { ConsumableItem } from './types/consumable-item';

export type { Dimension } from './types/dimension';
export type { CalculationRecord } from './types/calculation-record';
export { isValidCalculationRecord } from './types/calculation-record';
export type { BoQLineItem, BoQCategory } from './types/boq-line-item';
export { BOQ_CATEGORIES, isValidBoQLineItem } from './types/boq-line-item';
export type { ConsumableItem } from './types/consumable-item';
export type { PlantContext } from './types/plant-context';
export { defaultPlantContext } from './types/plant-context';
export type { UnitOutputs } from './types/unit-outputs';
export { emptyUnitOutputs } from './types/unit-outputs';

/** Water quality vector carried by every stream in the flowsheet */
export interface WaterQuality {
  flow: number;        // m³/d
  COD: number;         // mg/L total COD
  sCOD: number;        // mg/L soluble COD
  BOD5: number;        // mg/L
  TKN: number;         // mgN/L total Kjeldahl nitrogen
  NH3N: number;        // mgN/L ammonia nitrogen
  NO3N: number;        // mgN/L nitrate nitrogen
  TP: number;          // mgP/L total phosphorus
  TSS: number;         // mg/L total suspended solids
  VSS: number;         // mg/L volatile suspended solids
  pH: number;
  alkalinity: number;  // mmol/L
  DO: number;          // mg/L dissolved oxygen
  temperature: number; // °C
}

/**
 * Result from processing a unit — the existing `outputs` and `metadata`
 * fields are kept for backward compatibility. The new optional fields
 * (sizing, energy, consumables, capex, calculationRecords, warnings)
 * are the v2 extension — populated with empty defaults by all existing
 * units during Phase 1a, with real values to follow in Phase 1b.
 */
export interface ProcessResult {
  outputs: Record<string, WaterQuality>;
  metadata: Record<string, number>;
  /** v2 — sizing dimensions */
  sizing?: Record<string, Dimension>;
  /** v2 — energy demand */
  energy?: {
    installedKW: number;
    dailyKWh: number;
    records: CalculationRecord[];
  };
  /** v2 — daily consumables */
  consumables?: ConsumableItem[];
  /** v2 — Bill of Quantities contribution */
  capex?: {
    lineItems: BoQLineItem[];
    total: number;
  };
  /** v2 — full auditable calculation trail */
  calculationRecords?: CalculationRecord[];
  /** v2 — warnings raised during calculation */
  warnings?: string[];
}

/** Handle definition for node connections */
export interface HandleDef {
  id: string;
  label: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  type: 'input' | 'output';
}

/** Static definition of a process unit type */
export interface UnitDefinition {
  type: UnitType;
  label: string;
  description: string;
  icon: string;
  handles: HandleDef[];
  defaultParameters: Record<string, number>;
  parameterSchema: ParameterField[];
}

/** Schema for a single configurable parameter */
export interface ParameterField {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description?: string;
}

/** All supported process unit types */
export type UnitType =
  | 'influent'
  | 'primary_clarifier'
  | 'bioreactor_aerobic'
  | 'bioreactor_anoxic'
  | 'bioreactor_anaerobic'
  | 'secondary_clarifier'
  | 'splitter'
  | 'mixer'
  | 'thickener'
  | 'effluent';

/** Interface that every unit model must implement */
export interface ProcessUnit {
  type: UnitType;
  parameters: Record<string, number>;
  process(inputs: WaterQuality[]): ProcessResult;
}

/** Discharge compliance standards */
export interface DischargeStandards {
  COD?: number;
  BOD5?: number;
  NH3N?: number;
  NO3N?: number;
  TSS?: number;
  TP?: number;
  pH_min?: number;
  pH_max?: number;
}

/** Simulation results for the entire flowsheet */
export interface SimulationResults {
  nodeResults: Record<string, { outputs: Record<string, WaterQuality>; metadata: Record<string, number> }>;
  edgeResults: Record<string, WaterQuality>;
  converged: boolean;
  iterations: number;
  massBalanceError: number;
}

/** Create a default/empty water quality vector */
export function emptyWaterQuality(): WaterQuality {
  return {
    flow: 0, COD: 0, sCOD: 0, BOD5: 0,
    TKN: 0, NH3N: 0, NO3N: 0, TP: 0,
    TSS: 0, VSS: 0, pH: 7, alkalinity: 0,
    DO: 0, temperature: 20,
  };
}

/** Flow-weighted mixing of multiple streams */
export function mixStreams(streams: WaterQuality[]): WaterQuality {
  if (streams.length === 0) return emptyWaterQuality();
  if (streams.length === 1) return { ...streams[0] } as WaterQuality;

  const totalFlow = streams.reduce((sum, s) => sum + s.flow, 0);
  if (totalFlow === 0) return emptyWaterQuality();

  const mixed = emptyWaterQuality();
  mixed.flow = totalFlow;

  const concentrationKeys: (keyof WaterQuality)[] = [
    'COD', 'sCOD', 'BOD5', 'TKN', 'NH3N', 'NO3N', 'TP',
    'TSS', 'VSS', 'alkalinity', 'DO', 'temperature',
  ];

  for (const key of concentrationKeys) {
    mixed[key] = streams.reduce((sum, s) => sum + (s[key] as number) * s.flow, 0) / totalFlow;
  }

  // pH: approximate via flow-weighted H+ concentration
  const totalH = streams.reduce((sum, s) => sum + Math.pow(10, -s.pH) * s.flow, 0);
  mixed.pH = -Math.log10(totalH / totalFlow);

  return mixed;
}
