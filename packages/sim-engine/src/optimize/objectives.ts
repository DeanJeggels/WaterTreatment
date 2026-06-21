/**
 * Objective + feasibility model for the optimizer. Minimises CAPEX, OPEX and
 * footprint, subject to the effluent meeting the target standards and the
 * simulation converging.
 *
 * Sizing-derived objectives use the DELEGATED whole-reactor design when the train
 * is recognised (correct under recycle), while effluent compliance uses the real
 * per-block stream simulation (per-block effluent quality is valid). Costs are
 * transparent parametric planning rates (co-located, not magic inline numbers).
 */
import { evaluatePlant } from '../engine/evaluate';
import type { GraphDefinition } from '../engine/evaluate';
import type { MleMbrDesign } from '../design/mle-mbr';
import type { OptimizerSpec } from './genome';

/** Parametric planning cost rates, ZAR. */
const COST = {
  civilZarPerM3: 12000,        // reinforced concrete tankage
  blowerZarPerKw: 35000,       // installed aeration/scour blower
  membraneZarPerM2: 4500,      // MBR membrane + cassette + rack
  mechBalanceFactor: 1.4,      // pumps, pipework, valves, controls on the major mechanical
  tankDepthM: 4.5,
  mbrAreaFootprintFactor: 0.02, // m2 plan per m2 membrane
};

export interface ObjectiveOptions {
  energyTariffZarPerKwh?: number;
  operatingDaysPerYear?: number;
  footprintSpacingFactor?: number;
}

const O_DEFAULTS = { energyTariffZarPerKwh: 2.2, operatingDaysPerYear: 365, footprintSpacingFactor: 2.5 };

export interface Objectives {
  /** The minimisation objectives. */
  capexZar: number;
  opexZarPerYear: number;
  footprintM2: number;
  /** Effluent quality penalty (lower = cleaner water): COD + 10*NH3-N + TSS + 5*TP. */
  effluentQualityIndex: number;
  /** Feasibility: converged AND effluent within target standards. */
  feasible: boolean;
  /** Total normalised constraint violation (0 when feasible), for ranking infeasibles. */
  violation: number;
  /** Whether the canonical train was recognised and sized by the delegate. */
  delegated: boolean;
}

function costDesign(design: MleMbrDesign): number {
  const tankVol =
    design.reactor.aerobicVolumeM3 +
    design.reactor.anoxicVolumeM3 +
    design.reactor.anaerobicVolumeM3 +
    (design.tanks[0]?.volumeM3 ?? 0);
  const civil = tankVol * COST.civilZarPerM3;
  const blowerKw = design.aeration.blowerKW + design.mbr.scourBlowerKW;
  const blower = blowerKw * COST.blowerZarPerKw;
  const membrane = design.mbr.included ? design.mbr.membraneAreaM2 * COST.membraneZarPerM2 : 0;
  return civil + (blower + membrane) * COST.mechBalanceFactor;
}

function footprintDesign(design: MleMbrDesign, spacing: number): number {
  const tankVol =
    design.reactor.aerobicVolumeM3 +
    design.reactor.anoxicVolumeM3 +
    design.reactor.anaerobicVolumeM3 +
    (design.tanks[0]?.volumeM3 ?? 0);
  const tankArea = tankVol / COST.tankDepthM;
  const mbrArea = design.mbr.included ? design.mbr.membraneAreaM2 * COST.mbrAreaFootprintFactor : 0;
  return (tankArea + mbrArea) * spacing;
}

/** Evaluate a candidate plant: run the headless engine, derive the objectives. */
export function evaluateObjectives(graph: GraphDefinition, _spec: OptimizerSpec, options: ObjectiveOptions = {}): Objectives {
  const o = { ...O_DEFAULTS, ...options };
  const evalResult = evaluatePlant(graph, {
    energyTariffZarPerKwh: o.energyTariffZarPerKwh,
    operatingDaysPerYear: o.operatingDaysPerYear,
    footprintSpacingFactor: o.footprintSpacingFactor,
  });

  // Feasibility from the real per-block stream sim vs the target standards.
  const converged = evalResult.converged;
  const compliancePass = evalResult.compliancePass ?? false;
  let violation = converged ? 0 : 10;
  if (evalResult.compliance) {
    for (const c of Object.values(evalResult.compliance)) {
      if (!c.pass && c.limit > 0) violation += (c.value - c.limit) / c.limit;
    }
  }
  const feasible = converged && compliancePass;

  // Effluent quality penalty from the real simulated effluent (lower = cleaner).
  const e = evalResult.effluentStream;
  const effluentQualityIndex = e ? e.COD + 10 * e.NH3N + e.TSS + 5 * e.TP : 1e6;

  // Sizing-derived objectives: prefer the validated delegated design.
  const design = evalResult.delegatedDesign;
  let capexZar: number;
  let opexZarPerYear: number;
  let footprintM2: number;
  if (design) {
    capexZar = costDesign(design);
    opexZarPerYear = design.utilities.dutyKW * 24 * o.operatingDaysPerYear * o.energyTariffZarPerKwh;
    footprintM2 = footprintDesign(design, o.footprintSpacingFactor);
  } else {
    capexZar = evalResult.capexZar;
    opexZarPerYear = evalResult.opexZarPerYear;
    footprintM2 = evalResult.footprintM2;
  }

  return { capexZar, opexZarPerYear, footprintM2, effluentQualityIndex, feasible, violation, delegated: !!design };
}

/** Objective vector (all minimised) for domination tests. */
export function objectiveVector(obj: Objectives): number[] {
  return [obj.capexZar, obj.opexZarPerYear, obj.footprintM2, obj.effluentQualityIndex];
}
