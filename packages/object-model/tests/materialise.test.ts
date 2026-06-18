import { describe, it, expect } from 'vitest';
import type { SimulationResults, CalculationRecord, ProcessResult } from '@repo/sim-engine';
import { instantiateObjects, type MaterialiserNode, type MaterialiserEdge } from '../src/materialise';

const rec = (symbol: string, extra: Partial<CalculationRecord> = {}): CalculationRecord => ({
  label: symbol,
  symbol,
  equation: `${symbol} = …`,
  inputs: {},
  result: { value: 1, unit: '' },
  citation: 'test',
  ...extra,
});

const aerobicCalc: CalculationRecord[] = [rec('V'), rec('MLSS')];
const blowerCalc: CalculationRecord[] = [
  rec('P_blower', { inputs: { dP: { value: 59.1, unit: 'kPa', source: 'depth×9.81+15' } }, result: { value: 22.4, unit: 'kW' } }),
];

function aerobicResult(): ProcessResult {
  return {
    outputs: {},
    metadata: {},
    sizing: {
      volume: { value: 5000, unit: 'm3' },
      depth: { value: 4.5, unit: 'm' },
      HRT: { value: 12, unit: 'h' },
      MLSS: { value: 3850, unit: 'mg/L' },
      airFlow: { value: 1042, unit: 'Am3/hr' },
      blowerKW: { value: 22.4, unit: 'kW' },
    },
    energy: { installedKW: 22.4, dailyKWh: 537.6, records: blowerCalc },
    calculationRecords: aerobicCalc,
    warnings: ['MLSS within band'],
  };
}

function clarifierResult(): ProcessResult {
  return {
    outputs: {},
    metadata: {},
    sizing: { surfaceArea: { value: 1000, unit: 'm2' }, depth: { value: 3.5, unit: 'm' } },
    calculationRecords: [rec('A')],
  };
}

function fixture(): { nodes: MaterialiserNode[]; edges: MaterialiserEdge[]; results: SimulationResults } {
  const nodes: MaterialiserNode[] = [
    { id: 'node-influent', unitType: 'influent' },
    { id: 'node-aerobic', unitType: 'bioreactor_aerobic' },
    { id: 'node-clar', unitType: 'secondary_clarifier' },
    { id: 'node-effluent', unitType: 'effluent' },
  ];
  const edges: MaterialiserEdge[] = [
    { source: 'node-influent', target: 'node-aerobic', sourceHandle: 'out', targetHandle: 'in' },
    { source: 'node-aerobic', target: 'node-clar', sourceHandle: 'out', targetHandle: 'in' },
    { source: 'node-clar', target: 'node-effluent', sourceHandle: 'overflow', targetHandle: 'in' },
  ];
  const results: SimulationResults = {
    nodeResults: { 'node-aerobic': aerobicResult(), 'node-clar': clarifierResult() },
    edgeResults: {},
    converged: true,
    iterations: 1,
    massBalanceError: 0,
  };
  return { nodes, edges, results };
}

describe('instantiateObjects (T3.3)', () => {
  it('skips stream boundaries (influent/effluent) and materialises physical units', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const classes = objects.map((o) => o.class);
    expect(classes).toContain('reactor');
    expect(classes).toContain('clarifier');
    expect(classes).toContain('blower'); // spawned from the aerobic air sizing
    expect(objects.find((o) => o.label.toLowerCase().includes('influent'))).toBeUndefined();
  });

  it('aerobic node -> reactor object: capacity == sizing, sourceCalc == calculationRecords, ports from handles', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const reactor = objects.find((o) => o.id === 'obj-node-aerobic')!;
    expect(reactor.class).toBe('reactor');
    expect(reactor.capacity).toEqual(results.nodeResults['node-aerobic']!.sizing);
    expect(reactor.sourceCalc!.records).toEqual(aerobicCalc); // energy trail went to the blower
    expect(reactor.ports.map((p) => p.id)).toEqual(['in', 'out']);
    expect(reactor.tag).toBe('BIO-2101-TK');
  });

  it('spawns a blower carrying the energy trail + the copied ΔP', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const blower = objects.find((o) => o.class === 'blower')!;
    expect(blower.sourceCalc!.records).toEqual(blowerCalc);
    expect(blower.params.kind).toBe('blower');
    if (blower.params.kind === 'blower') {
      expect(blower.params.airFlowAm3H).toEqual({ value: 1042, unit: 'Am3/hr' });
      expect(blower.params.installedKW).toEqual({ value: 22.4, unit: 'kW' });
      expect(blower.params.dischargePressureKpa).toEqual({ value: 59.1, unit: 'kPa' });
    }
  });

  it('resolves connections to target OBJECT ids and drops boundary targets', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const reactor = objects.find((o) => o.id === 'obj-node-aerobic')!;
    expect(reactor.connections).toEqual([{ toObjectId: 'obj-node-clar', toPort: 'in', medium: 'water' }]);
    const clar = objects.find((o) => o.id === 'obj-node-clar')!;
    expect(clar.connections).toEqual([]); // its only edge targets the (skipped) effluent boundary
  });

  it('derives circular geometry for the clarifier from surfaceArea', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const clar = objects.find((o) => o.id === 'obj-node-clar')!;
    expect(clar.geometry.shape).toBe('circle');
    expect(clar.geometry.diameterM!.value).toBeCloseTo(35.68, 1);
  });

  it('never re-derives a number: capacity values are verbatim copies of sizing', () => {
    const { nodes, edges, results } = fixture();
    const objects = instantiateObjects(nodes, edges, results, { flowsheetId: 'fs-1' });
    const reactor = objects.find((o) => o.id === 'obj-node-aerobic')!;
    expect(reactor.capacity.volume).toBe(results.nodeResults['node-aerobic']!.sizing!.volume);
  });

  it('is deterministic (snapshot-stable)', () => {
    const a = instantiateObjects(...fixtureArgs());
    const b = instantiateObjects(...fixtureArgs());
    expect(a).toEqual(b);
  });
});

function fixtureArgs() {
  const { nodes, edges, results } = fixture();
  return [nodes, edges, results, { flowsheetId: 'fs-1' }] as const;
}
