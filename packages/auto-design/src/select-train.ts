/**
 * selectTrain — a DECLARATIVE plantType -> ordered process train. Config, NOT
 * math: it only chooses which (already-existing) sim-engine unit types appear
 * and in what order. All UnitTypes here are registered in @repo/sim-engine.
 */
import type { UnitType } from '@repo/sim-engine';
import type { PlantType } from './inputs';

export interface TrainOptions {
  plantType: PlantType;
  /** Add inline ferric dosing for chemical P-removal. */
  pRemoval: boolean;
  /** Add UV disinfection as the tertiary step (default true). */
  disinfection?: boolean;
}

export interface ProcessTopology {
  plantType: PlantType;
  /** Ordered water path, influent → effluent. */
  mainLine: UnitType[];
  /** Ordered sludge path, fed from the main-line clarifier/MBR sludge handle. */
  sludgeLine: UnitType[];
  /** Every unit in the train (mainLine then sludgeLine) — the flat ordered list. */
  units: UnitType[];
  pRemoval: boolean;
  disinfection: boolean;
}

const HEADWORKS: UnitType[] = [
  'influent',
  'inlet_pumping',
  'screen',
  'grit_removal',
  'equalisation_tank',
];

const BIOLOGICAL: UnitType[] = ['bioreactor_anoxic', 'bioreactor_aerobic'];

const SLUDGE_LINE: UnitType[] = ['thickener', 'dewatering'];

/**
 * Build the deterministic process topology for a plant type. Same options
 * always produce the same ordered train (snapshot-stable).
 */
export function selectTrain(opts: TrainOptions): ProcessTopology {
  const disinfection = opts.disinfection ?? true;

  // The liquid-solids separation stage differs by plant type.
  let separation: UnitType;
  switch (opts.plantType) {
    case 'MLE':
      separation = 'secondary_clarifier';
      break;
    case 'MBR':
      separation = 'mbr';
      break;
    default:
      throw new Error(
        `selectTrain: plant type '${opts.plantType}' is not supported in the MVP (MLE, MBR only).`,
      );
  }

  const mainLine: UnitType[] = [
    ...HEADWORKS,
    ...BIOLOGICAL,
    ...(opts.pRemoval ? (['chemical_dosing'] as UnitType[]) : []),
    separation,
    ...(disinfection ? (['uv_disinfection'] as UnitType[]) : []),
    'effluent',
  ];

  const sludgeLine = [...SLUDGE_LINE];

  return {
    plantType: opts.plantType,
    mainLine,
    sludgeLine,
    units: [...mainLine, ...sludgeLine],
    pRemoval: opts.pRemoval,
    disinfection,
  };
}
