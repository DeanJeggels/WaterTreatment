import { describe, it, expect } from 'vitest';
import { DWA_LIMITS, getDwaLimits } from '../src/dwa-limits';

describe('DWA limits', () => {
  it('defines General and Special tiers', () => {
    expect(DWA_LIMITS.General).toBeDefined();
    expect(DWA_LIMITS.Special).toBeDefined();
  });

  it('Special limits are stricter than General for nitrogen', () => {
    expect(DWA_LIMITS.Special.NH3N!).toBeLessThan(DWA_LIMITS.General.NH3N!);
  });

  it('getDwaLimits returns a cloneable object', () => {
    const g = getDwaLimits('General');
    g.COD = 9999;
    expect(getDwaLimits('General').COD).not.toBe(9999);
  });
});
