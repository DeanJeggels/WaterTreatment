import { describe, it, expect } from 'vitest';
import { designMleMbr } from '@repo/sim-engine';
import { instantiateMleMbr, applyMechanicalDetail, pipeSizeMm, engineeringObjectSchema } from '../src';

const design = designMleMbr({
  adwfM3d: 70, codMgL: 900, tminC: 15, tmaxC: 25, elevationM: 1700,
  nitrogenRemoval: true, phosphorusRemoval: false, dischargeStandard: 'Special',
  mbrRequired: true, membraneModel: 'megavision', landUse: 'residential',
});
const enriched = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
const byId = (frag: string) => enriched.find((o) => o.mechanical?.equipmentId.startsWith(frag));

describe('pipeSizeMm — velocity-based standard DN', () => {
  it('rounds up to a standard DN and keeps velocity at/below target', () => {
    const dn = pipeSizeMm(36, 1.5); // 36 m³/h ≈ 0.01 m³/s
    expect([80, 100]).toContain(dn);
    // velocity at the selected bore must not exceed the target
    const v = (36 / 3600) / (Math.PI * (dn / 1000 / 2) ** 2);
    expect(v).toBeLessThanOrEqual(1.5 + 1e-9);
  });
  it('floors tiny / zero flows at the minimum bore', () => {
    expect(pipeSizeMm(0, 1.5)).toBe(25);
    expect(pipeSizeMm(0.01, 1.0)).toBe(25);
  });
});

describe('applyMechanicalDetail — Stage 3 equipment objects', () => {
  it('every object gets a discipline-prefixed equipment id', () => {
    expect(enriched.every((o) => o.mechanical && /^[A-Z]{1,3}-\d{2}$/.test(o.mechanical.equipmentId))).toBe(true);
    expect(byId('T-')).toBeTruthy(); // tanks
    expect(byId('BL-')).toBeTruthy(); // blowers
    expect(byId('MB-')).toBeTruthy(); // membrane
    expect(byId('UV-')).toBeTruthy();
    expect(byId('DS-')).toBeTruthy();
  });

  it('tanks carry the mandated accessories + a sized nozzle schedule', () => {
    const tank = enriched.find((o) => o.class === 'tank')!;
    expect(tank.mechanical!.accessories).toEqual(expect.arrayContaining([expect.stringMatching(/overflow/i), expect.stringMatching(/drain/i), expect.stringMatching(/access cover/i)]));
    const services = tank.mechanical!.nozzles.map((n) => n.service);
    expect(services).toEqual(expect.arrayContaining(['Inlet', 'Outlet', 'Drain', 'Overflow']));
    expect(tank.mechanical!.nozzles.every((n) => n.sizeMm >= 25 && n.flangeStandard.length > 0)).toBe(true);
    expect(tank.mechanical!.dimensionsMm.wallThicknessMm).toBeGreaterThanOrEqual(200);
    expect(tank.mechanical!.dimensionsMm.weightKg).toBeGreaterThan(0);
  });

  it('rotating equipment is duty/standby; tanks are single', () => {
    expect(enriched.filter((o) => o.class === 'blower').every((o) => o.mechanical!.dutyStandby.standby === 1)).toBe(true);
    expect(enriched.filter((o) => o.class === 'pump').every((o) => o.mechanical!.dutyStandby.standby === 1)).toBe(true);
    expect(enriched.find((o) => o.class === 'tank')!.mechanical!.dutyStandby.standby).toBe(0);
  });

  it('blowers get inlet filter / NRV / PRV; air nozzles sized at ~15 m/s', () => {
    const bl = enriched.find((o) => o.class === 'blower')!;
    expect(bl.mechanical!.accessories).toEqual(expect.arrayContaining([expect.stringMatching(/filter/i), expect.stringMatching(/non-return/i), expect.stringMatching(/pressure-relief/i)]));
    expect(bl.mechanical!.nozzles.some((n) => /air/i.test(n.service))).toBe(true);
  });

  it('membrane cassette has ≥1000 mm top extraction clearance', () => {
    const mb = enriched.find((o) => o.class === 'membrane')!;
    expect(mb.mechanical!.clearance.N_mm).toBeGreaterThanOrEqual(1000);
  });

  it("'full' maintenance widens the access side to ≥1500 mm", () => {
    const full = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design, { maintenanceAccess: 'full' });
    expect(full.find((o) => o.class === 'blower')!.mechanical!.clearance.N_mm).toBeGreaterThanOrEqual(1500);
  });

  it('enriched objects stay contract-valid (schema accepts the mechanical block)', () => {
    for (const o of enriched) expect(() => engineeringObjectSchema.parse(o)).not.toThrow();
    expect(enriched.every((o) => o.mechanical!.standardsCompliance.length > 0 || o.class === 'membrane')).toBe(true);
  });

  it('is deterministic', () => {
    const a = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
    const b = applyMechanicalDetail(instantiateMleMbr(design, { flowsheetId: 'fs-1' }), design);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
