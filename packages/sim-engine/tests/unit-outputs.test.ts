import { describe, it, expect } from 'vitest';
import { emptyUnitOutputs } from '../src/types/unit-outputs';

describe('emptyUnitOutputs', () => {
  it('returns an object with all 6 extended fields populated with empty defaults', () => {
    const o = emptyUnitOutputs();
    expect(o.sizing).toEqual({});
    expect(o.energy.installedKW).toBe(0);
    expect(o.energy.dailyKWh).toBe(0);
    expect(o.energy.records).toEqual([]);
    expect(o.consumables).toEqual([]);
    expect(o.capex.lineItems).toEqual([]);
    expect(o.capex.total).toBe(0);
    expect(o.calculationRecords).toEqual([]);
    expect(o.warnings).toEqual([]);
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = emptyUnitOutputs();
    const b = emptyUnitOutputs();
    a.warnings.push('test');
    expect(b.warnings).toEqual([]);
  });
});
