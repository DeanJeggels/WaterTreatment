import { describe, it, expect } from 'vitest';
import { parseDesignPackage } from '@repo/object-model';
import { defaultMleMbrInputs, type MleMbrInputs } from '../src/inputs';
import { runMleMbr } from '../src/mle-mbr-run';

function inputs(): MleMbrInputs {
  const inp = defaultMleMbrInputs();
  inp.meta.projectName = 'Komani MBR';
  inp.footprintLengthM = 100;
  inp.footprintWidthM = 80;
  return inp;
}

const META = { projectId: 'p-1', flowsheetId: 'fs-1', generatedAt: '2026-06-18T09:00:00Z' };

describe('runMleMbr (end-to-end design path)', () => {
  const r = runMleMbr(inputs(), META);

  it('produces a contract-valid DesignPackage carrying the full design', () => {
    expect(() => parseDesignPackage(r.package)).not.toThrow();
    expect(r.package.mleMbr).toBeDefined();
    expect(r.package.meta.plantType).toBe('MLE-MBR');
  });

  it('every placeable object has a non-default placement after layout', () => {
    const placeable = r.objects.filter((o) => !o.ext?.insideParent);
    expect(placeable.every((o) => o.placement.location.x !== 0 || o.placement.location.y !== 0)).toBe(true);
  });

  it('snaps the MBR cassette to the aeration tank footprint (nested)', () => {
    const cassette = r.objects.find((o) => o.ext?.insideParent)!;
    const parent = r.objects.find((o) => o.id === cassette.ext!.parentId)!;
    expect(cassette.placement.location.x).toBe(parent.placement.location.x);
    expect(cassette.placement.location.y).toBe(parent.placement.location.y);
  });

  it('totals reflect installed power; capex is 0 (no CAPEX per spec)', () => {
    expect(r.package.totals.installedKW).toBeGreaterThan(0);
    expect(r.package.totals.capexZar).toBe(0);
  });

  it('compliance verdict from predicted effluent vs the DWA tier', () => {
    expect(Object.keys(r.package.compliance.perParameter).length).toBeGreaterThan(0);
    expect(typeof r.package.compliance.pass).toBe('boolean');
  });

  it('is deterministic', () => {
    expect(JSON.stringify(runMleMbr(inputs(), META).package)).toBe(JSON.stringify(runMleMbr(inputs(), META).package));
  });

  it('CALCULATES tank volumes from the inputs — they are never user-entered', () => {
    const d = runMleMbr(inputs(), META).design;
    // reactor/anoxic/aerobic volumes are computed, > 0, and consistent (Vt ≈ Va + Vax)
    expect(d.reactor.volumeSelectedM3).toBeGreaterThan(0);
    expect(d.reactor.aerobicVolumeM3).toBeGreaterThan(0);
    expect(d.reactor.anoxicVolumeM3).toBeGreaterThan(0);
    expect(d.reactor.aerobicVolumeM3 + d.reactor.anoxicVolumeM3).toBeCloseTo(d.reactor.volumeSelectedM3, 0);
    // EQ / buffer tank = 0.5 × ADWF (12 h holding) — the master rule
    const eq = d.tanks.find((t) => /buffer|equalis/i.test(t.name))!;
    expect(eq.volumeM3).toBeCloseTo(0.5 * inputs().adwfM3d, 1);
  });

  it('the selected reactor parameters drive the calculated volume (higher MLSS → smaller reactor)', () => {
    const lowMlss = { ...inputs(), reactorMlssMgL: 8000 };
    const highMlss = { ...inputs(), reactorMlssMgL: 12000 };
    const vLow = runMleMbr(lowMlss, META).design.reactor.volumeSelectedM3;
    const vHigh = runMleMbr(highMlss, META).design.reactor.volumeSelectedM3;
    expect(vHigh).toBeLessThan(vLow); // V = MXt / MLSS — higher MLSS shrinks the tank
    // longer sludge age → more sludge mass → larger reactor
    const vYoung = runMleMbr({ ...inputs(), sludgeAgeDays: 15 }, META).design.reactor.volumeSelectedM3;
    const vOld = runMleMbr({ ...inputs(), sludgeAgeDays: 25 }, META).design.reactor.volumeSelectedM3;
    expect(vOld).toBeGreaterThan(vYoung);
  });
});
