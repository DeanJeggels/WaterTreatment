import { describe, it, expect } from 'vitest';
import { parseDesignPackage } from '@repo/object-model';
import { defaultMleMbrInputs, type MleMbrInputs } from '../src/inputs';
import { runMleMbr } from '../src/mle-mbr-run';

function inputs(): MleMbrInputs {
  const inp = defaultMleMbrInputs();
  inp.meta.projectName = 'Komani MBR';
  inp.siteAreaM2 = 8000;
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
});
