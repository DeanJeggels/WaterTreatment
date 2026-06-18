import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  engineeringObjectSchema,
  designPackageSchema,
  parseDesignPackage,
  safeParseDesignPackage,
  siteLocalCoordinateSystem,
  type EngineeringObject,
  type DesignPackage,
} from '../src/index';

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
    capacity: { value: 5000, unit: 'm3' },
  },
  placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 },
  material: { primary: 'reinforced-concrete', grade: 'C35/45 W4' },
  capacity: { volume: { value: 5000, unit: 'm3' }, depth: { value: 4.5, unit: 'm' } },
  params: {
    kind: 'tank',
    function: 'aeration',
    volumeM3: { value: 5000, unit: 'm3' },
    sideWaterDepthM: { value: 4.5, unit: 'm' },
    bunded: false,
  },
  ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 16.6, z: 0.3 } }],
  connections: [{ toObjectId: 'obj-clarifier-1', toPort: 'in', medium: 'water' }],
  designNotes: ['layout geometry assumption'],
  sourceCalc: {
    flowsheetId: 'fs-1',
    nodeId: 'node-aerobic-1',
    unitType: 'bioreactor_aerobic',
    sizingKeys: ['volume', 'depth'],
    records: [
      {
        label: 'HRT',
        symbol: 'HRT',
        equation: 'HRT = V / Q × 24',
        inputs: { V: { value: 5000, unit: 'm3', source: 'sizing' }, Q: { value: 10000, unit: 'm3/d', source: 'inlet' } },
        result: { value: 12.0, unit: 'h' },
        citation: 'Ekama (1984)',
      },
    ],
  },
};

function fixturePackage(): DesignPackage {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      projectId: 'p-1',
      flowsheetId: 'fs-1',
      projectName: 'Komani WWTP',
      plantType: 'MLE',
      generatedAt: '2026-06-18T09:00:00Z',
      engine: { simEngine: '0.1.0', layout: '1.0.0' },
    },
    coordinateSystem: siteLocalCoordinateSystem({ description: 'SW peg BM-01', crs: 'EPSG:2049' }),
    inputs: { designFlowM3d: 10000, plantType: 'MLE', peakFactor: 2.5 },
    basis: {
      dischargeStandard: { COD: 75, TSS: 25 },
      influentBasis: { COD: 800, TKN: 65, TSS: 350 },
      designFlows: { adwf: 10000, awwf: 18000, pwwf: 25000 },
    },
    graph: {
      nodes: [{ id: 'node-aerobic-1', unitType: 'bioreactor_aerobic', label: 'Aeration', parameters: { volume: 5000 } }],
      edges: [],
    },
    objects: [aerationTank],
    layout: {
      siteBoundary: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 },
      ],
      corridors: [],
      bunds: [],
      pipeRoutes: [],
      violations: [],
      rulesApplied: [{ rule: 'spacing.default', objectId: 'obj-aeration-1' }],
    },
    boq: { grandTotalZar: 18400000, lineItemsByCategory: { civil: [], mechanical: [] } },
    compliance: { standard: 'DWA General', pass: true, perParameter: { COD: { target: 75, predicted: 60, pass: true } } },
    totals: { capexZar: 18400000, installedKW: 142, footprintM2: 2850 },
    provenance: { calculations: aerationTank.sourceCalc!.records, layoutRules: 'CH-ISE v1' },
  };
}

describe('engineeringObjectSchema (T0.3)', () => {
  it('accepts a valid object', () => {
    expect(engineeringObjectSchema.safeParse(aerationTank).success).toBe(true);
  });

  it('rejects a class/params mismatch (coherence refinement)', () => {
    const mismatched = { ...aerationTank, class: 'blower' as const }; // tank params on a blower class
    const result = engineeringObjectSchema.safeParse(mismatched);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/not valid for class/);
    }
  });

  it("allows the 'equipment' catch-all on any class", () => {
    const mixer: EngineeringObject = {
      ...aerationTank,
      class: 'mixer',
      params: { kind: 'equipment', equipmentType: 'mixer' },
      capacity: {},
      sourceCalc: undefined,
    };
    expect(engineeringObjectSchema.safeParse(mixer).success).toBe(true);
  });

  it('rejects a wrong schema version', () => {
    expect(engineeringObjectSchema.safeParse({ ...aerationTank, schemaVersion: '0.9.0' }).success).toBe(false);
  });
});

describe('designPackageSchema + parseDesignPackage (T0.3)', () => {
  it('parses a valid package', () => {
    expect(designPackageSchema.safeParse(fixturePackage()).success).toBe(true);
    expect(() => parseDesignPackage(fixturePackage())).not.toThrow();
  });

  it('round-trips: parse(JSON.parse(JSON.stringify(pkg))) deep-equals pkg', () => {
    const pkg = fixturePackage();
    const roundTripped = parseDesignPackage(JSON.parse(JSON.stringify(pkg)));
    expect(roundTripped).toEqual(pkg);
  });

  it('is deterministic: two builds serialise byte-identically', () => {
    expect(JSON.stringify(fixturePackage())).toBe(JSON.stringify(fixturePackage()));
  });

  it('rejects a package whose object violates coherence', () => {
    const pkg = fixturePackage();
    (pkg.objects[0] as EngineeringObject).class = 'pump';
    const result = safeParseDesignPackage(pkg);
    expect(result.success).toBe(false);
  });
});
