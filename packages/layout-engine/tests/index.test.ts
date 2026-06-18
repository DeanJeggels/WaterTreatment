import { describe, it, expect } from 'vitest';
import { layout, rectangularSite } from '../src/index';
import { mleObjects } from './helpers/objects';

describe('layout() entrypoint (T4.5)', () => {
  it('writes a non-default placement onto every object', () => {
    const objs = mleObjects();
    layout(objs, rectangularSite(100000));
    expect(objs.every((o) => o.placement.location.x !== 0 || o.placement.location.y !== 0)).toBe(true);
  });

  it('returns a complete PlantLayout', () => {
    const result = layout(mleObjects(), rectangularSite(100000));
    expect(Array.isArray(result.corridors)).toBe(true);
    expect(Array.isArray(result.bunds)).toBe(true);
    expect(Array.isArray(result.pipeRoutes)).toBe(true);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.rulesApplied.length).toBeGreaterThan(0);
    expect(result.siteBoundary.length).toBeGreaterThan(2);
  });

  it('flags a violation on an undersized site', () => {
    const result = layout(mleObjects(), rectangularSite(50));
    expect(result.violations.some((v) => v.code === 'site_area_exceeded')).toBe(true);
  });

  it('is deterministic across two full runs', () => {
    const a = mleObjects();
    const b = mleObjects();
    const la = layout(a, rectangularSite(100000));
    const lb = layout(b, rectangularSite(100000));
    expect(la).toEqual(lb);
    expect(a.map((o) => o.placement)).toEqual(b.map((o) => o.placement));
  });
});
