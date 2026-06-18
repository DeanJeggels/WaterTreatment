import { describe, it, expect } from 'vitest';
import type { EngineeringObject } from '@repo/object-model';
import { orderAndBand } from '../src/order-and-band';
import { pack, rectangularSite } from '../src/pack';
import { zones } from '../src/zones';
import { mleObjects, makeObject } from './helpers/objects';

function laidOut(): EngineeringObject[] {
  const objs = mleObjects();
  pack(orderAndBand(objs), objs, rectangularSite(100000));
  return objs;
}

describe('zones (T4.4)', () => {
  it('gives the dosing skid a bund >= 1.1x the tank volume', () => {
    const objs = laidOut();
    const { bunds } = zones(objs);
    const dosingBund = bunds.find((b) => b.servesObjectId === 'dosing')!;
    expect(dosingBund).toBeDefined();
    expect(dosingBund.capacityM3).toBeCloseTo(1.1 * 15, 5); // capacityM3 = 16.5
    expect(dosingBund.polygon.length).toBe(4);
  });

  it('rulesApplied is non-empty and references LAYOUT_RULES', () => {
    const { rulesApplied } = zones(laidOut());
    expect(rulesApplied.length).toBeGreaterThan(0);
    expect(rulesApplied.some((r) => r.rule === 'bunding.capacityFactor')).toBe(true);
    expect(rulesApplied.some((r) => r.rule.startsWith('access.'))).toBe(true);
  });

  it('shifts an electrical room clear of wet units by the separation distance', () => {
    const reactor = makeObject('reactor', 'reactor', { lengthM: 20, widthM: 10 });
    reactor.placement = { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 };
    const mcc = makeObject('mcc', 'electrical_room', { lengthM: 6, widthM: 4 });
    mcc.placement = { location: { x: 2, y: 0, z: 0 }, rotationDeg: 0 };
    zones([reactor, mcc]);
    const gapX = Math.abs(mcc.placement.location.x - reactor.placement.location.x) - (20 / 2 + 6 / 2);
    expect(gapX).toBeGreaterThanOrEqual(4.0 - 1e-6); // electricalToWet
  });

  it('builds maintenance + vehicle corridors', () => {
    const { corridors } = zones(laidOut());
    expect(corridors.map((c) => c.kind).sort()).toEqual(['maintenance', 'vehicle']);
    expect(corridors.find((c) => c.kind === 'vehicle')!.widthM).toBe(4.5);
  });

  it('routes orthogonal (Manhattan) pipes between connected objects', () => {
    const { pipeRoutes } = zones(laidOut());
    const aerobicToDosing = pipeRoutes.find((p) => p.fromObjectId === 'aerobic' && p.toObjectId === 'dosing')!;
    expect(aerobicToDosing).toBeDefined();
    expect(aerobicToDosing.points.length).toBe(3); // L-shaped
    expect(aerobicToDosing.medium).toBe('water');
  });

  it('is deterministic', () => {
    expect(zones(laidOut())).toEqual(zones(laidOut()));
  });
});
