import { describe, it, expect } from 'vitest';
import { SA_TYPICAL_INFLUENT } from '../src/defaults';

describe('SA typical influent defaults', () => {
  it('has a COD within the typical SA municipal range', () => {
    expect(SA_TYPICAL_INFLUENT.COD).toBeGreaterThan(400);
    expect(SA_TYPICAL_INFLUENT.COD).toBeLessThan(1200);
  });

  it('has TKN consistent with COD (ratio 0.06-0.12)', () => {
    const ratio = SA_TYPICAL_INFLUENT.TKN / SA_TYPICAL_INFLUENT.COD;
    expect(ratio).toBeGreaterThan(0.06);
    expect(ratio).toBeLessThan(0.12);
  });

  it('cites a source', () => {
    expect(SA_TYPICAL_INFLUENT.source.length).toBeGreaterThan(0);
  });
});
