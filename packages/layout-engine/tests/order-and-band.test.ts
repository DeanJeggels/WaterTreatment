import { describe, it, expect } from 'vitest';
import { orderAndBand, bandFor } from '../src/order-and-band';
import { mleObjects } from './helpers/objects';

describe('orderAndBand (T4.2)', () => {
  it('puts the water line in band B, sludge in A, chem/elec/utility in C', () => {
    const objs = mleObjects();
    const { bandOf } = orderAndBand(objs);
    expect(bandOf.get('aerobic')).toBe('B');
    expect(bandOf.get('clarifier')).toBe('B');
    expect(bandOf.get('uv')).toBe('B');
    expect(bandOf.get('thickener')).toBe('A');
    expect(bandOf.get('dewatering')).toBe('A');
    expect(bandOf.get('dosing')).toBe('C');
    expect(bandOf.get('aerobic-blower')).toBe('C');
  });

  it('orders the spine in process-flow (topological) order', () => {
    const { spine } = orderAndBand(mleObjects());
    const ids = spine.map((o) => o.id);
    expect(ids.indexOf('anoxic')).toBeLessThan(ids.indexOf('aerobic'));
    expect(ids.indexOf('aerobic')).toBeLessThan(ids.indexOf('clarifier'));
    expect(ids.indexOf('clarifier')).toBeLessThan(ids.indexOf('uv'));
  });

  it('bandFor maps classes directly', () => {
    expect(bandFor(mleObjects()[0]!)).toBe('B'); // screen
  });

  it('is deterministic', () => {
    const a = orderAndBand(mleObjects());
    const b = orderAndBand(mleObjects());
    expect(a.spine.map((o) => o.id)).toEqual(b.spine.map((o) => o.id));
  });
});
