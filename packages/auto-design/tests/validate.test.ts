import { describe, it, expect } from 'vitest';
import { defaultInputs } from '../src/inputs';
import { validateInputs } from '../src/validate';
import type { DesignInputs } from '../src/inputs';

/** A valid baseline: the preset with a project name filled in. */
function validInputs(): DesignInputs {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  return inp;
}

function codesFor(inp: DesignInputs, field: string): string[] {
  return validateInputs(inp).errors.filter((e) => e.field === field).map((e) => e.code);
}

describe('validateInputs (T1.2)', () => {
  it('accepts a valid baseline', () => {
    const result = validateInputs(validInputs());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires a project name', () => {
    const inp = validInputs();
    inp.meta.projectName = '   ';
    expect(codesFor(inp, 'meta.projectName')).toContain('required');
  });

  it('rejects designFlow <= 0', () => {
    const inp = validInputs();
    inp.designFlowM3d = 0;
    expect(codesFor(inp, 'designFlowM3d')).toContain('range');
  });

  it('rejects peakFactor < 1', () => {
    const inp = validInputs();
    inp.peakFactor = 0.8;
    expect(codesFor(inp, 'peakFactor')).toContain('range');
  });

  it('rejects sCOD > COD', () => {
    const inp = validInputs();
    inp.influent.sCOD = inp.influent.COD + 50;
    expect(codesFor(inp, 'influent.sCOD')).toContain('cross-field');
  });

  it('rejects NH3N > TKN', () => {
    const inp = validInputs();
    inp.influent.NH3N = inp.influent.TKN + 10;
    expect(codesFor(inp, 'influent.NH3N')).toContain('cross-field');
  });

  it('rejects an effluent target above the influent concentration', () => {
    const inp = validInputs();
    inp.effluentTargets = { ...inp.effluentTargets, COD: inp.influent.COD + 100, source: 'test' };
    expect(codesFor(inp, 'effluentTargets.COD')).toContain('cross-field');
  });

  it('rejects an out-of-range influent value (reused sim-engine ceiling)', () => {
    const inp = validInputs();
    inp.influent.COD = 5000; // > influent COD max (2000)
    expect(codesFor(inp, 'influent.COD')).toContain('range');
  });

  it('rejects a site too small for the flow', () => {
    const inp = validInputs();
    inp.designFlowM3d = 20000;
    inp.siteAreaM2 = 50; // way below the ~800 m² floor
    expect(codesFor(inp, 'siteAreaM2')).toContain('site-area');
  });

  it('is deterministic and pure', () => {
    const inp = validInputs();
    expect(validateInputs(inp)).toEqual(validateInputs(inp));
  });
});
