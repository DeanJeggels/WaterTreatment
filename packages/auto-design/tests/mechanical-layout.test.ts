import { describe, it, expect } from 'vitest';
import { designMleMbr } from '@repo/sim-engine';
import { instantiateMleMbr, applyMechanicalDetail, parseDesignPackage } from '@repo/object-model';
import { defaultMleMbrInputs, type MleMbrInputs } from '../src/inputs';
import { arrangeMechanicalLayout } from '../src/mechanical-layout';
import { runMleMbr } from '../src/mle-mbr-run';

function build(input: MleMbrInputs) {
  const design = designMleMbr({
    adwfM3d: input.adwfM3d, codMgL: input.codMgL, tminC: input.tminC, tmaxC: input.tmaxC, elevationM: input.elevationM,
    nitrogenRemoval: input.nitrogenRemoval, phosphorusRemoval: input.phosphorusRemoval, dischargeStandard: input.dischargeStandard,
    mbrRequired: input.mbrRequired, membraneModel: input.membraneModel, landUse: input.landUse,
  });
  const objects = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
  const placeable = objects.filter((o) => !o.ext?.insideParent);
  const res = arrangeMechanicalLayout(placeable, input, design);
  return { objects, placeable, res };
}
const tankOf = (objs: ReturnType<typeof build>['objects'], fn: string) => objs.find((o) => o.params.kind === 'tank' && o.params.function === fn)!;

describe('arrangeMechanicalLayout — Stage 4 civil', () => {
  const input = { ...defaultMleMbrInputs(), installationType: 'above_ground_civil' as const };
  const { objects, res } = build(input);

  it('places tanks in process-flow order along +X with ≥500 mm gaps, no container', () => {
    expect(res.container).toBeUndefined();
    const buf = tankOf(objects, 'equalisation');
    const anox = tankOf(objects, 'anoxic');
    const aer = tankOf(objects, 'mbr');
    expect(buf.placement.location.x).toBeLessThan(anox.placement.location.x);
    expect(anox.placement.location.x).toBeLessThan(aer.placement.location.x);
    // gap between buffer's right edge and anoxic's left edge ≥ 0.5 m
    const gap = (anox.placement.location.x - anox.geometry.footprint.lengthM / 2) - (buf.placement.location.x + buf.geometry.footprint.lengthM / 2);
    expect(gap).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });

  it('mirrors the duty/standby blowers and records orientation', () => {
    const blowers = objects.filter((o) => o.class === 'blower');
    expect(blowers.map((b) => b.placement.rotationDeg).sort((a, b) => a - b)).toEqual([90, 270]);
    expect(blowers.every((b) => typeof (b.ext?.orientation) === 'string')).toBe(true);
  });

  it('groups blowers in front of the tank array (−Y of the tank row)', () => {
    const aer = tankOf(objects, 'mbr');
    const blower = objects.find((o) => o.class === 'blower')!;
    expect(blower.placement.location.y).toBeLessThan(aer.placement.location.y);
  });

  it('underground / in-ground sets tank z below grade', () => {
    const { objects: ug } = build({ ...input, installationType: 'underground_civil' });
    expect(tankOf(ug, 'mbr').placement.location.z).toBeLessThan(0);
  });
});

describe('arrangeMechanicalLayout — Stage 4 containerised', () => {
  const input = { ...defaultMleMbrInputs(), installationType: 'container_40ft' as const };
  const { objects, res } = build(input);

  it('emits a container housing object with the correct internal length', () => {
    expect(res.container).toBeDefined();
    expect(res.container!.class).toBe('building');
    expect(res.container!.geometry.footprint.lengthM).toBeCloseTo(12.032, 2);
  });

  it('houses pump/blowers/UV inside the container in zones A/B/C', () => {
    const housed = objects.filter((o) => o.ext?.parentContainer === res.container!.id);
    expect(housed.length).toBeGreaterThanOrEqual(4);
    const zonesUsed = new Set(housed.map((o) => o.ext?.containerZone));
    expect(zonesUsed.has('A')).toBe(true);
    expect(zonesUsed.has('B')).toBe(true);
    expect(zonesUsed.has('C')).toBe(true);
  });

  it('keeps tanks external to the container (behind it, +Y)', () => {
    const aer = tankOf(objects, 'mbr');
    expect(aer.placement.location.y).toBeGreaterThan(res.container!.placement.location.y);
  });
});

describe('Stage 4 through the full run path', () => {
  it('container is persisted in a contract-valid package; rules recorded', () => {
    const input = { ...defaultMleMbrInputs(), installationType: 'container_20ft' as const, meta: { projectName: 'Container MBR' } };
    const r = runMleMbr(input, { projectId: 'p', flowsheetId: 'fs', generatedAt: '2026-06-19T00:00:00Z' });
    expect(() => parseDesignPackage(r.package)).not.toThrow();
    expect(r.objects.some((o) => o.class === 'building')).toBe(true);
    expect(r.package.layout.rulesApplied.some((x) => /Zone A/.test(x.rule))).toBe(true);
  });

  it('is deterministic', () => {
    const input = { ...defaultMleMbrInputs(), meta: { projectName: 'Det' } };
    const a = runMleMbr(input, { projectId: 'p', flowsheetId: 'fs', generatedAt: '2026-06-19T00:00:00Z' });
    const b = runMleMbr(input, { projectId: 'p', flowsheetId: 'fs', generatedAt: '2026-06-19T00:00:00Z' });
    expect(JSON.stringify(a.package)).toBe(JSON.stringify(b.package));
  });
});
