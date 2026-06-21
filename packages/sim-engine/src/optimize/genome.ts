/**
 * Genome encoding + decoding for the plant optimizer. A candidate is a fixed-
 * length vector of reals in [0, 1] (so NSGA-II's SBX/mutation operate on a clean
 * continuous space). The decoder maps it to discrete topology choices plus
 * continuous sizing, then builds a GraphDefinition for the headless engine.
 */
import type { GraphNode, GraphEdge } from '../graph/topological-sort';
import type { GraphDefinition } from '../engine/evaluate';
import type { DischargeStandards } from '../types';

export interface OptimizerSpec {
  /** Average dry-weather flow, m3/d. */
  flowM3d: number;
  /** Raw influent total COD, mg/L. */
  codMgL: number;
  /** Minimum design temperature, C. */
  tminC?: number;
  /** Site elevation, m. */
  elevationM?: number;
  /** Target discharge standards (the hard effluent constraint). */
  standards: DischargeStandards;
}

export interface DecisionVars {
  nitrogenRemoval: boolean; // include an anoxic zone + IMLR (MLE)
  mbr: boolean;             // membrane separation vs secondary clarifier
  srtDays: number;
  mlssMgL: number;
  anoxicFraction: number;
  aRecycle: number;
}

/** Continuous-variable bounds (engineer-native). */
const BOUNDS = {
  srt: [10, 30] as const,
  anoxicFraction: [0.1, 0.45] as const,
  aRecycle: [2, 6] as const,
  mlssConventional: [3000, 5000] as const,
  mlssMbr: [8000, 13000] as const,
};

/** [g_nremoval, g_mbr, g_srt, g_mlss, g_fxt, g_arec] all in [0,1]. */
export const GENOME_LENGTH = 6;

const lerp = (g: number, lo: number, hi: number): number => lo + (hi - lo) * Math.min(1, Math.max(0, g));

export function decodeVars(genome: number[]): DecisionVars {
  const mbr = genome[1]! >= 0.5;
  const [mlo, mhi] = mbr ? BOUNDS.mlssMbr : BOUNDS.mlssConventional;
  return {
    nitrogenRemoval: genome[0]! >= 0.5,
    mbr,
    srtDays: lerp(genome[2]!, BOUNDS.srt[0], BOUNDS.srt[1]),
    mlssMgL: lerp(genome[3]!, mlo, mhi),
    anoxicFraction: lerp(genome[4]!, BOUNDS.anoxicFraction[0], BOUNDS.anoxicFraction[1]),
    aRecycle: lerp(genome[5]!, BOUNDS.aRecycle[0], BOUNDS.aRecycle[1]),
  };
}

/** Influent characterisation derived from total COD (WWTP Design.xlsm ratios). */
function influentParams(spec: OptimizerSpec): Record<string, number> {
  const COD = spec.codMgL;
  const TKN = COD * 0.075;
  const TSS = COD * 0.45;
  return {
    flow: spec.flowM3d, COD,
    sCOD: COD * 0.29, BOD5: COD * 0.44,
    TKN, NH3N: TKN * 0.75, NO3N: 0, TP: COD * 0.015,
    TSS, VSS: TSS * 0.8,
    pH: 7.2, alkalinity: 4.4, DO: 0, temperature: spec.tminC ?? 15,
  };
}

/**
 * Build the GraphDefinition for a candidate. Topology:
 *   influent -> [anoxic] -> aerobic -> (mbr | secondary_clarifier) -> effluent
 * with an IMLR recycle (aerobic -> anoxic) when nitrogen removal is selected and
 * a RAS recycle (separator underflow -> the first reactor) for clarifier trains.
 */
export function decodeToGraph(vars: DecisionVars, spec: OptimizerSpec): GraphDefinition {
  const nodes: GraphNode[] = [
    { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: influentParams(spec) } },
  ];
  const edges: GraphEdge[] = [];
  const firstReactorId = vars.nitrogenRemoval ? 'anx' : 'aer';

  if (vars.nitrogenRemoval) {
    nodes.push({ id: 'anx', type: 'processUnit', data: { unitType: 'bioreactor_anoxic', parameters: { volume: Math.max(50, spec.flowM3d * 0.05), anoxic_fraction: vars.anoxicFraction, srt: vars.srtDays } } });
  }
  nodes.push({ id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt: vars.srtDays, mlss: vars.mlssMgL, do_setpoint: 2, elevation_m: spec.elevationM ?? 1700 } } });

  const sepId = vars.mbr ? 'mbr' : 'sc';
  if (vars.mbr) {
    nodes.push({ id: 'mbr', type: 'processUnit', data: { unitType: 'mbr', parameters: {} } });
  } else {
    nodes.push({ id: 'sc', type: 'processUnit', data: { unitType: 'secondary_clarifier', parameters: { surface_area: Math.max(50, spec.flowM3d * 0.12), depth: 4, tss_removal: 99.5, uo_ratio: 0.75 } } });
  }
  nodes.push({ id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } });

  // Forward chain.
  edges.push({ id: 'feed', source: 'inf', target: firstReactorId, sourceHandle: 'out', targetHandle: 'in' });
  if (vars.nitrogenRemoval) {
    edges.push({ id: 'anx_aer', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' });
  }
  edges.push({ id: 'aer_sep', source: 'aer', target: sepId, sourceHandle: 'out', targetHandle: 'in' });
  edges.push({ id: 'sep_eff', source: sepId, target: 'eff', sourceHandle: vars.mbr ? 'permeate' : 'overflow', targetHandle: 'in' });

  // Recycles. IMLR (aerobic -> anoxic) only when there is an anoxic zone.
  if (vars.nitrogenRemoval) {
    edges.push({ id: 'imlr', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: vars.aRecycle });
  }
  // RAS from a clarifier underflow back to the first reactor (MBR has no RAS).
  if (!vars.mbr) {
    edges.push({ id: 'ras', source: 'sc', target: firstReactorId, sourceHandle: 'underflow', targetHandle: 'in', recycleRatio: 0.75 });
  }

  return { nodes, edges, standards: spec.standards };
}
