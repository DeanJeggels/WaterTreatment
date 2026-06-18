import { describe, it, expect } from 'vitest';
import { isValidCalculationRecord } from '@repo/sim-engine';
import {
  SCHEMA_VERSION,
  siteLocalCoordinateSystem,
  type EngineeringObject,
  type ObjectParams,
} from '../src/index';

// ---------------------------------------------------------------------------
// Typed fixtures. The `: EngineeringObject` annotations are the compile-time
// half of T0.2's verify ("a fixture EngineeringObject literal typechecks");
// the assertions below are the runtime half. Class↔params coherence is NOT
// type-locked by §3 (it is enforced by the zod schema in T0.3).
// ---------------------------------------------------------------------------

const aerationTank: EngineeringObject = {
  schemaVersion: SCHEMA_VERSION,
  id: 'obj-aeration-1',
  tag: 'BIO-2101-TK',
  class: 'tank',
  discipline: 'process',
  label: 'Aeration Tank No.1',
  geometry: {
    shape: 'rectangle',
    footprint: { lengthM: 33.4, widthM: 33.3 },
    heightM: { value: 5.0, unit: 'm' },
    freeboardM: { value: 0.5, unit: 'm' },
    capacity: { value: 5000, unit: 'm3' },
  },
  placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 },
  material: { primary: 'reinforced-concrete', grade: 'C35/45 W4 watertight' },
  capacity: {
    volume: { value: 5000, unit: 'm3' },
    depth: { value: 4.5, unit: 'm' },
    MLSS: { value: 3850, unit: 'mg/L' },
  },
  params: {
    kind: 'tank',
    function: 'aeration',
    volumeM3: { value: 5000, unit: 'm3' },
    sideWaterDepthM: { value: 4.5, unit: 'm' },
    freeboardM: { value: 0.5, unit: 'm' },
    hydraulicRetentionTimeH: { value: 12.0, unit: 'h' },
    mlssMgL: { value: 3850, unit: 'mg/L' },
    bunded: false,
  },
  ports: [
    { id: 'in', role: 'inlet', localOffset: { x: 0, y: 16.6, z: 0.3 }, nominalBoreMm: { value: 400, unit: 'mm' } },
    { id: 'out', role: 'outlet', localOffset: { x: 33.4, y: 16.6, z: 4.3 }, nominalBoreMm: { value: 400, unit: 'mm' } },
    { id: 'air', role: 'air', localOffset: { x: 16.7, y: 0, z: 0.2 }, nominalBoreMm: { value: 250, unit: 'mm' } },
  ],
  connections: [{ toObjectId: 'obj-clarifier-1', toPort: 'in', medium: 'water' }],
  designNotes: ['Footprint assumes 2:1 plan at 4.5 m SWD — layout geometry assumption.'],
  sourceCalc: {
    flowsheetId: 'fs-9b21',
    nodeId: 'node-aerobic-1',
    unitType: 'bioreactor_aerobic',
    sizingKeys: ['volume', 'depth', 'MLSS'],
    records: [
      {
        label: 'Hydraulic retention time',
        symbol: 'HRT',
        equation: 'HRT = V / Q × 24',
        inputs: {
          V: { value: 5000, unit: 'm3', source: 'sizing.volume' },
          Q: { value: 10000, unit: 'm3/d', source: 'inlet flow' },
        },
        result: { value: 12.0, unit: 'h' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.1',
      },
    ],
  },
};

const processBlower: EngineeringObject = {
  schemaVersion: SCHEMA_VERSION,
  id: 'obj-blower-1',
  tag: 'BLW-2101-A',
  class: 'blower',
  discipline: 'mechanical',
  label: 'Process Air Blower A (duty)',
  geometry: { shape: 'rectangle', footprint: { lengthM: 2.4, widthM: 1.6 }, heightM: { value: 1.8, unit: 'm' } },
  placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'blower' },
  material: { primary: 'carbon-steel', coating: 'painted skid + acoustic hood' },
  capacity: { airFlow: { value: 1042, unit: 'Am3/hr' }, blowerKW: { value: 22.4, unit: 'kW' } },
  params: {
    kind: 'blower',
    blowerType: 'positive-displacement',
    airFlowAm3H: { value: 1042, unit: 'Am3/hr' },
    dischargePressureKpa: { value: 59.1, unit: 'kPa' },
    installedKW: { value: 22.4, unit: 'kW' },
    configuration: '2 duty + 1 standby',
    vfd: true,
  },
  ports: [{ id: 'air', role: 'air', localOffset: { x: 0, y: 0.8, z: 0.9 }, nominalBoreMm: { value: 250, unit: 'mm' } }],
  connections: [{ toObjectId: 'obj-air-header-2101', toPort: 'main', medium: 'air' }],
  designNotes: ['PD class: 22.4 kW < 50 kW HST threshold.'],
};

const ferricDosing: EngineeringObject = {
  schemaVersion: SCHEMA_VERSION,
  id: 'obj-dosing-1',
  tag: 'CDS-3201-FE',
  class: 'dosing_skid',
  discipline: 'mechanical',
  label: 'Ferric Chloride Dosing Skid',
  geometry: { shape: 'rectangle', footprint: { lengthM: 4.5, widthM: 3.0 }, capacity: { value: 14.8, unit: 'm3' } },
  placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'chemical' },
  material: { primary: 'HDPE' },
  capacity: { tankVolume: { value: 14.8, unit: 'm3' }, dailyConsumption: { value: 300, unit: 'kg/d' } },
  params: {
    kind: 'dosing_skid',
    chemical: 'ferric-chloride',
    doseMgL: { value: 30, unit: 'mg/L' },
    dailyConsumptionKg: { value: 300, unit: 'kg/d' },
    storageDays: { value: 7, unit: 'd' },
    storageTankVolumeM3: { value: 14.8, unit: 'm3' },
    meteringPumps: { duty: 1, standby: 1, pumpType: 'diaphragm' },
    bunded: true,
    bundVolumeM3: { value: 16.3, unit: 'm3' },
  },
  ports: [{ id: 'dose', role: 'chemical', localOffset: { x: 4.5, y: 1.5, z: 0.5 }, nominalBoreMm: { value: 25, unit: 'mm' } }],
  connections: [{ toObjectId: 'obj-rapid-mix-3201', toPort: 'chem_in', medium: 'chemical' }],
  designNotes: ['Bund ≥110% largest tank — chemical bunding layout rule.'],
};

const uvChannel: EngineeringObject = {
  schemaVersion: SCHEMA_VERSION,
  id: 'obj-uv-1',
  tag: 'UV-3301-A',
  class: 'disinfection',
  discipline: 'process',
  label: 'UV Disinfection Channel',
  geometry: { shape: 'rectangle', footprint: { lengthM: 6.0, widthM: 1.2 } },
  placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 },
  material: { primary: 'stainless-316' },
  capacity: {},
  params: { kind: 'equipment', equipmentType: 'uv-channel', installedKW: { value: 8, unit: 'kW' } },
  ports: [
    { id: 'in', role: 'inlet', localOffset: { x: 0, y: 0.6, z: 0 } },
    { id: 'out', role: 'outlet', localOffset: { x: 6.0, y: 0.6, z: 0 } },
  ],
  connections: [],
  designNotes: [],
};

describe('EngineeringObject type model (T0.2)', () => {
  it('stamps the schema version 1.0.0', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
    for (const obj of [aerationTank, processBlower, ferricDosing, uvChannel]) {
      expect(obj.schemaVersion).toBe('1.0.0');
    }
  });

  it('keeps the bounding footprint present on every object (layout packs on it)', () => {
    for (const obj of [aerationTank, processBlower, ferricDosing, uvChannel]) {
      expect(typeof obj.geometry.footprint.lengthM).toBe('number');
      expect(typeof obj.geometry.footprint.widthM).toBe('number');
    }
  });

  it('carries sized magnitudes verbatim in `capacity` as Dimensions', () => {
    expect(aerationTank.capacity.volume).toEqual({ value: 5000, unit: 'm3' });
    expect(aerationTank.capacity.MLSS).toEqual({ value: 3850, unit: 'mg/L' });
    // Blower capacity uses the camelCase sim-engine sizing keys.
    expect(processBlower.capacity.airFlow).toEqual({ value: 1042, unit: 'Am3/hr' });
    expect(processBlower.capacity.blowerKW).toEqual({ value: 22.4, unit: 'kW' });
  });

  it('narrows ObjectParams by `kind`', () => {
    const params: ObjectParams = aerationTank.params;
    expect(params.kind).toBe('tank');
    if (params.kind === 'tank') {
      // Narrowed to TankParams — field access is type-safe here.
      expect(params.volumeM3.value).toBe(5000);
      expect(params.function).toBe('aeration');
    }
    if (processBlower.params.kind === 'blower') {
      expect(processBlower.params.installedKW.value).toBe(22.4);
      expect(processBlower.params.configuration).toBe('2 duty + 1 standby');
    }
    if (ferricDosing.params.kind === 'dosing_skid') {
      expect(ferricDosing.params.bunded).toBe(true);
    }
    if (uvChannel.params.kind === 'equipment') {
      expect(uvChannel.params.equipmentType).toBe('uv-channel');
    }
  });

  it('exercises all six MVP param kinds across the fixture set + a pump/screen', () => {
    const pump: ObjectParams = {
      kind: 'pump',
      service: 'inlet',
      pumpType: 'submersible',
      dutyFlowM3H: { value: 420, unit: 'm3/hr' },
      headM: { value: 12, unit: 'm' },
      installedKW: { value: 18.5, unit: 'kW' },
      configuration: '2 duty + 1 standby',
    };
    const screen: ObjectParams = {
      kind: 'screen',
      screenType: 'fine',
      apertureMm: { value: 6, unit: 'mm' },
    };
    const kinds = new Set(
      [aerationTank.params, processBlower.params, ferricDosing.params, uvChannel.params, pump, screen].map(
        (p) => p.kind,
      ),
    );
    expect(kinds).toEqual(new Set(['tank', 'blower', 'dosing_skid', 'equipment', 'pump', 'screen']));
  });

  it('copies sim-engine CalculationRecords by value, still valid under the frozen validator', () => {
    expect(aerationTank.sourceCalc).toBeDefined();
    expect(aerationTank.sourceCalc!.records.length).toBeGreaterThan(0);
    for (const record of aerationTank.sourceCalc!.records) {
      expect(isValidCalculationRecord(record)).toBe(true);
    }
    expect(aerationTank.sourceCalc!.unitType).toBe('bioreactor_aerobic');
    expect(aerationTank.sourceCalc!.sizingKeys).toContain('volume');
  });

  it('derives ports from unit handles', () => {
    expect(aerationTank.ports.map((p) => p.id)).toEqual(['in', 'out', 'air']);
    expect(aerationTank.ports.find((p) => p.id === 'air')?.role).toBe('air');
  });

  it('leaves placement at the origin until the layout engine runs', () => {
    expect(uvChannel.placement).toEqual({ location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 });
  });
});

describe('CoordinateSystem (T0.2)', () => {
  it('builds a deterministic, fixed-convention site-local system', () => {
    const a = siteLocalCoordinateSystem();
    const b = siteLocalCoordinateSystem();
    expect(a).toEqual(b); // deterministic — no clock, no randomness
    expect(a.convention).toBe('right-handed-z-up');
    expect(a.linearUnit).toBe('m');
    expect(a.angleUnit).toBe('deg');
  });

  it('carries an optional geo-reference on the origin', () => {
    const cs = siteLocalCoordinateSystem({ description: 'SW peg BM-01', crs: 'EPSG:2049', groundLevelMamsl: 1320 });
    expect(cs.origin.crs).toBe('EPSG:2049');
    expect(cs.origin.groundLevelMamsl).toBe(1320);
  });
});
