import { describe, it, expect } from 'vitest';
import { optimizePlant } from '../src/optimize/nsga2';
import type { OptimizerSpec } from '../src/optimize/genome';
import { makeRng } from '../src/optimize/prng';

/**
 * Phase 4 acceptance: NSGA-II returns a Pareto-optimal (non-dominated) set of
 * fully-sized plants trading off CAPEX / OPEX / footprint, subject to the target
 * effluent constraints. Deterministic via the seeded PRNG.
 */

const SPEC: OptimizerSpec = {
  flowM3d: 5000,
  codMgL: 700,
  tminC: 15,
  elevationM: 1700,
  // Special-limits style target effluent.
  standards: { COD: 75, NH3N: 6, TSS: 25 },
};

describe('Phase 4 — NSGA-II Pareto optimization over topology + sizing', () => {
  it('returns a non-dominated, feasible, constraint-respecting Pareto front', () => {
    const result = optimizePlant(SPEC, { populationSize: 24, generations: 15, seed: 42 });

    // eslint-disable-next-line no-console
    console.log(`Pareto front (${result.paretoFront.length} points, ${result.evaluations} evals, ${result.feasibleCount} feasible in final pop):`);
    // eslint-disable-next-line no-console
    console.table(result.paretoFront.map(p => ({
      train: `${p.vars.nitrogenRemoval ? 'MLE' : 'AS'}${p.vars.mbr ? '+MBR' : '+SC'}`,
      SRT_d: Math.round(p.vars.srtDays),
      MLSS: Math.round(p.vars.mlssMgL),
      CAPEX_Mzar: Math.round(p.objectives.capexZar / 1e5) / 10,
      OPEX_Mzar_yr: Math.round(p.objectives.opexZarPerYear / 1e5) / 10,
      footprint_m2: Math.round(p.objectives.footprintM2),
      effluentIdx: Math.round(p.objectives.effluentQualityIndex),
    })));

    expect(result.paretoFront.length).toBeGreaterThan(0);

    // Every returned point is feasible (meets the effluent constraints).
    for (const p of result.paretoFront) {
      expect(p.objectives.feasible).toBe(true);
      expect(p.objectives.capexZar).toBeGreaterThan(0);
      expect(p.objectives.opexZarPerYear).toBeGreaterThan(0);
      expect(p.objectives.footprintM2).toBeGreaterThan(0);
      expect(p.objectives.effluentQualityIndex).toBeGreaterThan(0);
    }

    // Genuinely non-dominated: no point dominates another across all 4 objectives.
    const objs = (o: typeof pf[number]['objectives']) => [o.capexZar, o.opexZarPerYear, o.footprintM2, o.effluentQualityIndex];
    const pf = result.paretoFront;
    for (let i = 0; i < pf.length; i++) {
      for (let j = 0; j < pf.length; j++) {
        if (i === j) continue;
        const a = objs(pf[i]!.objectives), b = objs(pf[j]!.objectives);
        const aDomB = a.every((v, k) => v <= b[k]!) && a.some((v, k) => v < b[k]!);
        expect(aDomB, `point ${i} dominates ${j}`).toBe(false);
      }
    }
  });

  it('presents a real trade-off (cheapest plant is not also the cleanest effluent)', () => {
    const result = optimizePlant(SPEC, { populationSize: 32, generations: 20, seed: 42 });
    const pf = result.paretoFront;
    expect(pf.length).toBeGreaterThan(1); // a genuine multi-point Pareto front
    const minCapex = pf.reduce((m, p) => (p.objectives.capexZar < m.objectives.capexZar ? p : m));
    const minEff = pf.reduce((m, p) => (p.objectives.effluentQualityIndex < m.objectives.effluentQualityIndex ? p : m));
    // Buying the cleanest effluent costs more than the cheapest compliant plant.
    expect(minEff.objectives.capexZar).toBeGreaterThan(minCapex.objectives.capexZar);
    expect(minCapex.objectives.effluentQualityIndex).toBeGreaterThan(minEff.objectives.effluentQualityIndex);
  });

  it('is deterministic: same seed gives an identical Pareto front', () => {
    const a = optimizePlant(SPEC, { populationSize: 16, generations: 10, seed: 7 });
    const b = optimizePlant(SPEC, { populationSize: 16, generations: 10, seed: 7 });
    expect(a.paretoFront.length).toBe(b.paretoFront.length);
    for (let i = 0; i < a.paretoFront.length; i++) {
      expect(a.paretoFront[i]!.objectives.capexZar).toBe(b.paretoFront[i]!.objectives.capexZar);
      expect(a.paretoFront[i]!.objectives.footprintM2).toBe(b.paretoFront[i]!.objectives.footprintM2);
    }
  });

  it('rejects candidates that violate the effluent target (constraint handling)', () => {
    // An impossible standard (COD 1 mg/L) should yield no feasible point.
    const impossible = optimizePlant(
      { ...SPEC, standards: { COD: 1, NH3N: 0.01, TSS: 0.1 } },
      { populationSize: 16, generations: 8, seed: 99 },
    );
    expect(impossible.feasibleCount).toBe(0);
    for (const p of impossible.paretoFront) {
      expect(p.objectives.feasible).toBe(false); // falls back to least-violating set, all infeasible
    }
  });

  it('seeded PRNG is deterministic and bounded', () => {
    const r = makeRng(123);
    const seq = [r.next(), r.next(), r.next()];
    const r2 = makeRng(123);
    expect([r2.next(), r2.next(), r2.next()]).toEqual(seq);
    for (const x of seq) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});
