import { describe, it, expect } from 'vitest';
import { getDwaLimits, SA_TYPICAL_INFLUENT } from '@repo/design-library';
import { defaultInputs } from '../src/index';

describe('defaultInputs (T1.1)', () => {
  it('seeds influent from SA_TYPICAL_INFLUENT', () => {
    const inp = defaultInputs('General');
    expect(inp.influent.COD).toBe(SA_TYPICAL_INFLUENT.COD);
    expect(inp.influent.sCOD).toBe(SA_TYPICAL_INFLUENT.CODfiltered);
    expect(inp.influent.NH3N).toBe(SA_TYPICAL_INFLUENT.FSA);
    expect(inp.influent.TKN).toBe(SA_TYPICAL_INFLUENT.TKN);
    expect(inp.influent.TP).toBe(SA_TYPICAL_INFLUENT.TP);
  });

  it('resolves effluent targets to getDwaLimits(tier)', () => {
    expect(defaultInputs('General').effluentTargets).toEqual(getDwaLimits('General'));
    expect(defaultInputs('Special').effluentTargets).toEqual(getDwaLimits('Special'));
  });

  it('defaults to the MLE train with peakFactor >= 1', () => {
    const inp = defaultInputs();
    expect(inp.plantType).toBe('MLE');
    expect(inp.peakFactor).toBeGreaterThanOrEqual(1);
    expect(inp.designFlowM3d).toBeGreaterThan(0);
  });

  it('recommends P-removal when raw TP exceeds the discharge target', () => {
    // SA typical TP=12 > General TP target 10 -> pRemoval true.
    expect(defaultInputs('General').preferences.pRemoval).toBe(true);
  });

  it('is deterministic (no clock/randomness)', () => {
    expect(defaultInputs('General')).toEqual(defaultInputs('General'));
  });
});
