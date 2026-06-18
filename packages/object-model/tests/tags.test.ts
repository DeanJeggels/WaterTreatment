import { describe, it, expect } from 'vitest';
import { allocateTag, processAreaFor } from '../src/tags';
import { materialFor } from '../src/materials';

describe('allocateTag (T3.2)', () => {
  it('blower area 2 unit 1 -> BLW-2101-A', () => {
    expect(allocateTag(2, 'aeration_blower', 1)).toBe('BLW-2101-A');
  });

  it('aerobic reactor area 2 unit 1 -> BIO-2101-TK', () => {
    expect(allocateTag(2, 'bioreactor_aerobic', 1)).toBe('BIO-2101-TK');
  });

  it('emits duty letters for rotating plant by sequence', () => {
    expect(allocateTag(1, 'inlet_pumping', 1)).toBe('PMP-1101-A');
    expect(allocateTag(1, 'inlet_pumping', 2)).toBe('PMP-1102-B');
  });

  it('is deterministic — same inputs, identical tag', () => {
    expect(allocateTag(3, 'secondary_clarifier', 1)).toBe(allocateTag(3, 'secondary_clarifier', 1));
    expect(allocateTag(3, 'secondary_clarifier', 1)).toBe('CLR-3101-TK');
  });

  it('maps units to their process area', () => {
    expect(processAreaFor('screen')).toBe(1);
    expect(processAreaFor('bioreactor_aerobic')).toBe(2);
    expect(processAreaFor('secondary_clarifier')).toBe(3);
    expect(processAreaFor('thickener')).toBe(4);
  });
});

describe('materialFor (T3.2)', () => {
  it('returns watertight RC for biological tanks', () => {
    expect(materialFor('bioreactor_aerobic')).toEqual({ primary: 'reinforced-concrete', grade: 'C35/45 W4 watertight' });
  });

  it('returns HDPE + bund for dosing skids and steel for blowers', () => {
    expect(materialFor('chemical_dosing').primary).toBe('HDPE');
    expect(materialFor('aeration_blower').primary).toBe('carbon-steel');
  });

  it('falls back to carbon-steel for unknown units and returns a fresh object', () => {
    const a = materialFor('mystery');
    expect(a.primary).toBe('carbon-steel');
    expect(materialFor('mystery')).not.toBe(a); // new object each call (no shared mutation)
  });
});
