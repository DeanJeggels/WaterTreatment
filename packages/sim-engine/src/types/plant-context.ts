/**
 * Plant-level environmental and design context, shared across all units.
 * Populated once per simulation run and passed to every unit's process() call.
 */
export interface PlantContext {
  ambientTemperature: { min: number; max: number };
  siteElevation: number;
  dischargeStandard: 'General' | 'Special';
  designFlows: { adwf: number; awwf: number; pwwf: number };
}

/** A minimal valid PlantContext for tests and defaults */
export function defaultPlantContext(): PlantContext {
  return {
    ambientTemperature: { min: 15, max: 25 },
    siteElevation: 1700,
    dischargeStandard: 'General',
    designFlows: { adwf: 1000, awwf: 1100, pwwf: 2750 },
  };
}
