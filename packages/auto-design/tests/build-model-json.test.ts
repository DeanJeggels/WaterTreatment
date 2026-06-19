import { describe, it, expect } from 'vitest';
import { designMleMbr } from '@repo/sim-engine';
import { instantiateMleMbr, applyMechanicalDetail } from '@repo/object-model';
import { defaultMleMbrInputs, type MleMbrInputs } from '../src/inputs';
import { arrangeMechanicalLayout } from '../src/mechanical-layout';
import { buildModelJson, type ModelJson } from '../src/build-model-json';
import { runMleMbr } from '../src/mle-mbr-run';

function build(input: MleMbrInputs): ModelJson {
  const design = designMleMbr({
    adwfM3d: input.adwfM3d, codMgL: input.codMgL, tminC: input.tminC, tmaxC: input.tmaxC, elevationM: input.elevationM,
    nitrogenRemoval: input.nitrogenRemoval, phosphorusRemoval: input.phosphorusRemoval, dischargeStandard: input.dischargeStandard,
    mbrRequired: input.mbrRequired, membraneModel: input.membraneModel, landUse: input.landUse,
  });
  const objects = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
  const placeable = objects.filter((o) => !o.ext?.insideParent);
  const mech = arrangeMechanicalLayout(placeable, input, design);
  const all = mech.container ? [...objects, mech.container] : objects;
  return buildModelJson(all, design, input);
}

describe('buildModelJson — Stage 6 model data', () => {
  const m = build(defaultMleMbrInputs());

  it('emits an equipment object per source object with full detail', () => {
    expect(m.equipment.length).toBeGreaterThanOrEqual(13);
    for (const e of m.equipment) {
      expect(e.equipmentId).toMatch(/^[A-Z]{1,3}-\d{2}$/);
      expect(typeof e.position.x_mm).toBe('number');
      expect(e.maintenance_clearance).toBeDefined();
      expect(typeof e.civil_notes).toBe('string');
    }
    // tanks carry a nozzle schedule
    const tank = m.equipment.find((e) => e.type === 'tank')!;
    expect(tank.nozzles.length).toBeGreaterThan(0);
    expect(tank.nozzles.every((n) => n.size_mm >= 25 && n.flange_standard.length > 0)).toBe(true);
  });

  it('emits a sized pipe run per connection, velocity within the band', () => {
    expect(m.pipework.length).toBeGreaterThan(0);
    for (const p of m.pipework) {
      expect(p.pipe_size_mm).toBeGreaterThanOrEqual(p.fluid === 'sludge' ? 50 : 25);
      expect(p.velocity_ms).toBeGreaterThan(0);
      expect(p.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(p.colour_code.length).toBeGreaterThan(0);
      expect(p.from_equipment).not.toBe('UNKNOWN');
      expect(p.to_equipment).not.toBe('UNKNOWN');
    }
    // air lines sized high-velocity → bigger flow, smaller relative bore vs water
    const air = m.pipework.find((p) => p.fluid === 'air');
    if (air) expect(air.velocity_ms).toBeLessThanOrEqual(20);
    const water = m.pipework.find((p) => p.fluid === 'water');
    if (water) expect(water.velocity_ms).toBeLessThanOrEqual(2.5);
  });

  it('connections reference a real pipe id, internals link nested objects', () => {
    const pipeIds = new Set(m.pipework.map((p) => p.id));
    for (const e of m.equipment) for (const c of e.connections) if (c.pipe_id) expect(pipeIds.has(c.pipe_id)).toBe(true);
    // the aeration tank lists the MBR cassette as an internal
    const aer = m.equipment.find((e) => /Aeration/.test(e.description))!;
    expect(aer.internals.length).toBeGreaterThan(0);
  });

  it('layout object carries site, hardstand, access, drainage, corridors', () => {
    expect(m.layout.site_boundary.L_mm).toBe(80000);
    expect(m.layout.hardstand.fall).toMatch(/1:100/);
    expect(m.layout.access_points.length).toBeGreaterThan(0);
    expect(m.layout.drainage.fall_direction).toMatch(/inlet/);
    expect(m.layout.pipe_corridors[0]!.centreline.length).toBe(2);
  });

  it('container install records the container position + internal dims', () => {
    const cm = build({ ...defaultMleMbrInputs(), installationType: 'container_40ft' });
    expect(cm.layout.container).toBeDefined();
    expect(cm.layout.container!.internal_L_mm).toBeGreaterThan(11000);
    expect(cm.equipment.some((e) => e.parent_container)).toBe(true);
  });

  it('is persisted on the package and is deterministic', () => {
    const out = runMleMbr({ ...defaultMleMbrInputs(), meta: { projectName: 'Model' } }, { projectId: 'p', flowsheetId: 'fs', generatedAt: '2026-06-19T00:00:00Z' });
    expect(out.package.modelJson).toBeDefined();
    expect((out.package.modelJson as unknown as ModelJson).schema).toBe('aquasim.model/1');
    expect(JSON.stringify(build(defaultMleMbrInputs()))).toBe(JSON.stringify(build(defaultMleMbrInputs())));
  });
});
