import { describe, it, expect } from 'vitest';
import { parseDesignPackage } from '@repo/object-model';
import { defaultInputs } from '../src/inputs';
import { runAutoDesign } from '../src/run';
import { assembleDesignPackage } from '../src/assemble';
import type { DesignInputs } from '../src/inputs';

function validInputs(): DesignInputs {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  inp.designFlowM3d = 10000;
  inp.siteAreaM2 = 40000;
  return inp;
}

const META = { projectId: 'p-1', flowsheetId: 'fs-1', generatedAt: '2026-06-18T09:00:00Z' };

describe('assembleDesignPackage (T5.1)', () => {
  it('produces a package that passes parseDesignPackage', () => {
    const run = runAutoDesign(validInputs(), { flowsheetId: 'fs-1' });
    const pkg = assembleDesignPackage(run, META);
    expect(() => parseDesignPackage(pkg)).not.toThrow();
    expect(pkg.schemaVersion).toBe('1.0.0');
    expect(pkg.meta.generatedAt).toBe('2026-06-18T09:00:00Z');
  });

  it('totals.footprintM2 = Σ object footprints', () => {
    const run = runAutoDesign(validInputs(), { flowsheetId: 'fs-1' });
    const pkg = assembleDesignPackage(run, META);
    const expected = run.objects.reduce(
      (s, o) => s + o.geometry.footprint.lengthM * o.geometry.footprint.widthM,
      0,
    );
    expect(pkg.totals.footprintM2).toBeCloseTo(expected, 1);
  });

  it('carries a non-empty provenance calculation trail', () => {
    const run = runAutoDesign(validInputs(), { flowsheetId: 'fs-1' });
    const pkg = assembleDesignPackage(run, META);
    expect(pkg.provenance.calculations.length).toBeGreaterThan(0);
    expect(pkg.objects.length).toBeGreaterThan(0);
  });

  it('maps compliance to {target, predicted, pass}', () => {
    const run = runAutoDesign(validInputs(), { flowsheetId: 'fs-1' });
    const pkg = assembleDesignPackage(run, META);
    const entries = Object.values(pkg.compliance.perParameter);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(typeof e.target).toBe('number');
      expect(typeof e.predicted).toBe('number');
      expect(typeof e.pass).toBe('boolean');
    }
  });

  it('is deterministic for a fixed generatedAt (byte-identical JSON)', () => {
    const a = assembleDesignPackage(runAutoDesign(validInputs(), { flowsheetId: 'fs-1' }), META);
    const b = assembleDesignPackage(runAutoDesign(validInputs(), { flowsheetId: 'fs-1' }), META);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
