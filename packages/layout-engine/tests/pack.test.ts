import { describe, it, expect } from 'vitest';
import type { EngineeringObject } from '@repo/object-model';
import { orderAndBand } from '../src/order-and-band';
import { pack, rectangularSite } from '../src/pack';
import { mleObjects } from './helpers/objects';

function footprintsOverlap(a: EngineeringObject, b: EngineeringObject): boolean {
  const ax = a.placement.location.x, ay = a.placement.location.y;
  const bx = b.placement.location.x, by = b.placement.location.y;
  const ahx = a.geometry.footprint.lengthM / 2, ahy = a.geometry.footprint.widthM / 2;
  const bhx = b.geometry.footprint.lengthM / 2, bhy = b.geometry.footprint.widthM / 2;
  const overlapX = Math.abs(ax - bx) < ahx + bhx - 1e-6;
  const overlapY = Math.abs(ay - by) < ahy + bhy - 1e-6;
  return overlapX && overlapY;
}

describe('pack (T4.3)', () => {
  it('no two footprints overlap after relax', () => {
    const objs = mleObjects();
    pack(orderAndBand(objs), objs, rectangularSite(100000));
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        expect(footprintsOverlap(objs[i]!, objs[j]!)).toBe(false);
      }
    }
  });

  it('places the spine with strictly increasing x', () => {
    const objs = mleObjects();
    const { spine } = orderAndBand(objs);
    pack(orderAndBand(objs), objs, rectangularSite(100000));
    const xs = spine.map((o) => objs.find((p) => p.id === o.id)!.placement.location.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  });

  it('writes a non-default placement onto every object', () => {
    const objs = mleObjects();
    pack(orderAndBand(objs), objs, rectangularSite(100000));
    // at least one coordinate moved off the origin for each (spine x, or band y)
    expect(objs.every((o) => o.placement.location.x !== 0 || o.placement.location.y !== 0)).toBe(true);
  });

  it('emits site_area_exceeded (not a silent overlap) when the site is too small', () => {
    const objs = mleObjects();
    const result = pack(orderAndBand(objs), objs, rectangularSite(50));
    expect(result.violations.some((v) => v.code === 'site_area_exceeded')).toBe(true);
    expect(result.violations[0]!.message).toMatch(/MBR/);
  });

  it('records spacing rules applied', () => {
    const objs = mleObjects();
    const result = pack(orderAndBand(objs), objs, rectangularSite(100000));
    expect(result.rulesApplied.some((r) => r.rule.startsWith('spacing.'))).toBe(true);
  });

  it('is deterministic', () => {
    const a = mleObjects();
    const b = mleObjects();
    pack(orderAndBand(a), a, rectangularSite(100000));
    pack(orderAndBand(b), b, rectangularSite(100000));
    expect(a.map((o) => o.placement)).toEqual(b.map((o) => o.placement));
  });
});
