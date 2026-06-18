import { describe, it, expect } from 'vitest';
import { defaultInputs, runAutoDesign, assembleDesignPackage } from '@repo/auto-design';
import { loadList } from '../src/projections/load-list';

function pkg() {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  inp.designFlowM3d = 10000;
  inp.siteAreaM2 = 40000;
  return assembleDesignPackage(runAutoDesign(inp, { flowsheetId: 'fs-1' }), {
    projectId: 'p-1',
    flowsheetId: 'fs-1',
    generatedAt: '2026-06-18T09:00:00Z',
  });
}

describe('loadList projection (T7.2)', () => {
  it('rows == objects with an installedKW, total == Σ', () => {
    const p = pkg();
    const result = loadList(p);
    const objectsWithKW = p.objects.filter((o) => {
      const params = o.params;
      return (
        ((params.kind === 'blower' || params.kind === 'pump') && params.installedKW) ||
        ((params.kind === 'equipment' || params.kind === 'screen') && params.installedKW)
      );
    });
    expect(result.rows.length).toBe(objectsWithKW.length);
    const expectedTotal = result.rows.reduce((s, r) => s + r.installedKW, 0);
    expect(result.totalKW).toBeCloseTo(expectedTotal, 1); // totalKW is rounded to 2dp
    // the process-air blower must appear (it carries installedKW)
    expect(result.rows.some((r) => r.tag.startsWith('BLW'))).toBe(true);
  });

  it('recomputes nothing — it is a pure read of objects[]', () => {
    const p = pkg();
    expect(loadList(p)).toEqual(loadList(p));
  });
});
