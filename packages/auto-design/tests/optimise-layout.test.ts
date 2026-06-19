import { describe, it, expect } from 'vitest';
import { designMleMbr } from '@repo/sim-engine';
import { instantiateMleMbr, applyMechanicalDetail } from '@repo/object-model';
import { defaultMleMbrInputs, type MleMbrInputs } from '../src/inputs';
import { optimiseLayout, weightsFor } from '../src/optimise-layout';
import { runMleMbr } from '../src/mle-mbr-run';

function build(input: MleMbrInputs) {
  const design = designMleMbr({
    adwfM3d: input.adwfM3d, codMgL: input.codMgL, tminC: input.tminC, tmaxC: input.tmaxC, elevationM: input.elevationM,
    nitrogenRemoval: input.nitrogenRemoval, phosphorusRemoval: input.phosphorusRemoval, dischargeStandard: input.dischargeStandard,
    mbrRequired: input.mbrRequired, membraneModel: input.membraneModel, landUse: input.landUse,
  });
  const objects = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
  const placeable = objects.filter((o) => !o.ext?.insideParent);
  return { design, placeable };
}

describe('weightsFor — client priority tilts the soft objectives', () => {
  it('lowest cost raises pipe/bend weights; best access raises the access weight', () => {
    expect(weightsFor('lowest_cost').pipe).toBeGreaterThan(weightsFor('best_access').pipe);
    expect(weightsFor('best_access').access).toBeGreaterThan(weightsFor('lowest_cost').access);
    expect(weightsFor('smallest_footprint').footprint).toBeGreaterThan(weightsFor('best_access').footprint);
  });
});

describe('optimiseLayout — Stage 5', () => {
  const input = { ...defaultMleMbrInputs(), footprintLengthM: 120, footprintWidthM: 90 };
  const { design, placeable } = build(input);
  const r = optimiseLayout(placeable, input, design);

  it('returns up to 3 ranked candidates, best first, with a selection', () => {
    expect(r.candidates.length).toBeGreaterThanOrEqual(1);
    expect(r.candidates.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < r.candidates.length; i++) expect(r.candidates[i - 1]!.score).toBeLessThanOrEqual(r.candidates[i]!.score);
    expect(r.selected.key).toBe(r.candidates[0]!.key);
  });

  it('computes the full metric set + an access rating for each candidate', () => {
    for (const c of r.candidates) {
      expect(c.metrics.pipeLengthM).toBeGreaterThan(0);
      expect(c.metrics.footprintM2).toBeGreaterThan(0);
      expect(['Poor', 'Adequate', 'Good', 'Excellent']).toContain(c.metrics.maintenanceAccess);
      expect(typeof c.score).toBe('number');
    }
  });

  it('applies the selected placements back onto the passed objects', () => {
    const placed = placeable.filter((o) => !o.ext?.insideParent);
    expect(placed.every((o) => o.placement.location.x !== 0 || o.placement.location.y !== 0)).toBe(true);
  });

  it('the compact candidate has a smaller footprint than the access candidate', () => {
    // run a fresh optimisation to read all three by key (selection-independent)
    const all = optimiseLayout(build(input).placeable, input, design).candidates;
    const compact = all.find((c) => c.key === 'compact');
    const access = all.find((c) => c.key === 'access');
    if (compact && access) expect(compact.metrics.footprintM2).toBeLessThan(access.metrics.footprintM2);
  });

  it('best-access priority prefers a higher access rating than smallest-footprint', () => {
    const accInput = { ...input, clientPriority: 'best_access' as const };
    const fpInput = { ...input, clientPriority: 'smallest_footprint' as const };
    const accSel = optimiseLayout(build(accInput).placeable, accInput, design).selected;
    const fpSel = optimiseLayout(build(fpInput).placeable, fpInput, design).selected;
    const rank = { Poor: 0, Adequate: 1, Good: 2, Excellent: 3 } as const;
    expect(rank[accSel.metrics.maintenanceAccess]).toBeGreaterThanOrEqual(rank[fpSel.metrics.maintenanceAccess]);
  });

  it('is deterministic', () => {
    const a = optimiseLayout(build(input).placeable, input, design);
    const b = optimiseLayout(build(input).placeable, input, design);
    expect(a.selected.key).toBe(b.selected.key);
    expect(a.candidates.map((c) => c.score)).toEqual(b.candidates.map((c) => c.score));
  });

  it('never moves container-housed equipment outside the container envelope', () => {
    const cInput = { ...defaultMleMbrInputs(), installationType: 'container_40ft' as const, footprintLengthM: 120, footprintWidthM: 90 };
    const { design: cDesign, placeable: cPlaceable } = build(cInput);
    const res = optimiseLayout(cPlaceable, cInput, cDesign);
    const container = res.container!;
    expect(container).toBeDefined();
    const cx = container.placement.location.x, halfL = container.geometry.footprint.lengthM / 2;
    const cy = container.placement.location.y, halfW = container.geometry.footprint.widthM / 2;
    // every candidate's housed equipment stays within the container footprint (+0.3 m tol)
    for (const cand of res.candidates) {
      const housed = cand.objects.filter((o) => o.ext?.parentContainer);
      for (const h of housed) {
        expect(Math.abs(h.placement.location.x - cx)).toBeLessThanOrEqual(halfL + 0.3);
        expect(Math.abs(h.placement.location.y - cy)).toBeLessThanOrEqual(halfW + 0.3);
      }
    }
  });
});

describe('Stage 5 through the run path', () => {
  it('persists the top-3 layoutOptions with one selected', () => {
    const input = { ...defaultMleMbrInputs(), meta: { projectName: 'Opt MBR' } };
    const out = runMleMbr(input, { projectId: 'p', flowsheetId: 'fs', generatedAt: '2026-06-19T00:00:00Z' });
    const opts = out.package.layoutOptions as Array<Record<string, unknown>> | undefined;
    expect(opts).toBeDefined();
    expect(opts!.length).toBeGreaterThanOrEqual(1);
    expect(opts!.filter((o) => o.selected === true)).toHaveLength(1);
    expect(out.package.layout.rulesApplied.some((x) => /Layout optimisation/.test(x.rule))).toBe(true);
  });
});
