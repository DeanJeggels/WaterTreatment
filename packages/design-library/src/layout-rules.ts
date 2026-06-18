/**
 * LAYOUT_RULES — encoded plant-layout engineering judgement as DATA, versioned
 * here alongside supplier-prices.ts so it is reviewable in git. The layout engine
 * reads these; it never hard-codes a spacing or separation distance. All values
 * in metres. Source provenance is carried on the object itself.
 *
 * Maps to the design vision: maintenance access (access + corridors), process
 * order (topo spine), min spacing (spacing), safety/electrical separation
 * (separation), chemical bunding (bunding), site boundary (hard fit assertion).
 */
export const LAYOUT_RULES = {
  /** Wall-to-wall clearance between adjacent units, metres. */
  spacing: {
    default: 2.0,
    byClass: { clarifier: 3.0, reactor: 2.5, blower: 1.5, pump: 1.0 } as Record<string, number>,
  },
  access: {
    corridorWidth: 3.0,
    vehicleWidth: 4.5,
    requireOnSides: 1,
    rotatingEquipmentRing: 1.0,
  },
  bunding: {
    margin: 1.0,
    capacityFactor: 1.1,
  },
  separation: {
    electricalToWet: 4.0,
    electricalToChemical: 5.0,
    chemicalToProcess: 3.0,
  },
  safety: {
    uvClearance: 1.5,
    confinedSpaceHatch: 1.0,
  },
  bands: {
    sludge: 'top',
    water: 'mid',
    chemicalElectrical: 'bottom',
    laneOffsetM: 12.0,
  },
  flowAxis: 'x',
  source: 'CH-ISE layout heuristics v1; SANS 10400 access principles',
} as const;

export type LayoutRules = typeof LAYOUT_RULES;
