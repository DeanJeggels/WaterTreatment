import { describe, it, expect } from 'vitest';
import type { SimulationResults, ProcessResult, CalculationRecord } from '@repo/sim-engine';
import { instantiateObjects, type EngineeringObject, type MaterialiserNode } from '../src/index';

/**
 * 3D-readiness (T7.3) — locks the "JSON = 3D/BIM source of truth" guarantee:
 * every object must be extrudable (footprint + height/diameter + placement +
 * ports). This is the invariant a future 3D generator relies on.
 */
const rec = (s: string): CalculationRecord => ({
  label: s, symbol: s, equation: `${s}=…`, inputs: {}, result: { value: 1, unit: '' }, citation: 't',
});

function results(): { nodes: MaterialiserNode[]; results: SimulationResults } {
  const aerobic: ProcessResult = {
    outputs: {},
    metadata: {},
    sizing: {
      volume: { value: 5000, unit: 'm3' },
      depth: { value: 4.5, unit: 'm' },
      airFlow: { value: 1042, unit: 'Am3/hr' },
      blowerKW: { value: 22.4, unit: 'kW' },
    },
    energy: { installedKW: 22.4, dailyKWh: 537, records: [rec('P')] },
    calculationRecords: [rec('V')],
  };
  const clar: ProcessResult = {
    outputs: {},
    metadata: {},
    sizing: { surfaceArea: { value: 1000, unit: 'm2' }, depth: { value: 3.5, unit: 'm' } },
    calculationRecords: [rec('A')],
  };
  return {
    nodes: [
      { id: 'node-aerobic', unitType: 'bioreactor_aerobic' },
      { id: 'node-clar', unitType: 'secondary_clarifier' },
      { id: 'node-screen', unitType: 'screen' },
    ],
    results: {
      nodeResults: { 'node-aerobic': aerobic, 'node-clar': clar, 'node-screen': { outputs: {}, metadata: {} } },
      edgeResults: {},
      converged: true,
      iterations: 1,
      massBalanceError: 0,
    },
  };
}

function isExtrudable(o: EngineeringObject): boolean {
  const hasHeight = o.geometry.heightM !== undefined || o.geometry.diameterM !== undefined;
  const hasFootprint = o.geometry.footprint.lengthM > 0 && o.geometry.footprint.widthM > 0;
  const hasPlacement = o.placement !== undefined && typeof o.placement.location.z === 'number';
  return hasHeight && hasFootprint && hasPlacement && Array.isArray(o.ports);
}

describe('3D-readiness (T7.3)', () => {
  it('every materialised object is extrudable (footprint + height/diameter + placement + ports)', () => {
    const { nodes, results: r } = results();
    const objects = instantiateObjects(nodes, [], r, { flowsheetId: 'fs-1' });
    expect(objects.length).toBeGreaterThan(0);
    for (const o of objects) expect(isExtrudable(o)).toBe(true);
  });

  it('removing heightM (and diameter) fails the extrudability assertion', () => {
    const { nodes, results: r } = results();
    const [obj] = instantiateObjects(nodes, [], r, { flowsheetId: 'fs-1' });
    const broken: EngineeringObject = {
      ...obj!,
      geometry: { ...obj!.geometry, heightM: undefined, diameterM: undefined },
    };
    expect(isExtrudable(broken)).toBe(false);
  });
});
