import { describe, it, expect } from 'vitest';
import { simulate } from '../src/graph/simulator';
import { checkCompliance } from '../src/units/index';
import type { GraphNode, GraphEdge } from '../src/graph/topological-sort';
import type { WaterQuality, DischargeStandards, ProcessResult } from '../src/types';
import { assertValidV2Outputs } from './helpers/v2-outputs';
import { assertAllRecordsValid } from './helpers/calculation-records';

// ── Conventional Activated Sludge Train ─────────────────────
// Influent → Primary Clarifier → Aerobic Bioreactor → Secondary Clarifier → Effluent
function conventionalASFlowsheet(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    {
      id: 'inf',
      type: 'processUnit',
      data: {
        unitType: 'influent',
        parameters: {
          flow: 10000, COD: 500, sCOD: 200, BOD5: 250,
          TKN: 40, NH3N: 25, NO3N: 0.5, TP: 8,
          TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5,
          DO: 0, temperature: 20,
        },
      },
    },
    {
      id: 'pc',
      type: 'processUnit',
      data: {
        unitType: 'primary_clarifier',
        parameters: {
          tss_removal: 60, bod_removal: 30, cod_removal: 30,
          tkn_removal: 15, tp_removal: 10,
          surface_area: 500, depth: 3.5, uo_ratio: 0.05,
        },
      },
    },
    {
      id: 'aer',
      type: 'processUnit',
      data: {
        unitType: 'bioreactor_aerobic',
        parameters: {
          volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45,
          nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
        },
      },
    },
    {
      id: 'sc',
      type: 'processUnit',
      data: {
        unitType: 'secondary_clarifier',
        parameters: {
          surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75,
        },
      },
    },
    {
      id: 'eff',
      type: 'processUnit',
      data: {
        unitType: 'effluent',
        parameters: {},
      },
    },
  ];

  const edges: GraphEdge[] = [
    { id: 'e1', source: 'inf', target: 'pc', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e2', source: 'pc', target: 'aer', sourceHandle: 'overflow', targetHandle: 'in' },
    { id: 'e3', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e4', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
  ];

  return { nodes, edges };
}

describe('Simulator: Conventional AS', () => {
  it('converges without recycle edges', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);

    expect(results.converged).toBe(true);
    expect(results.iterations).toBe(1); // no recycles
  });

  it('produces results for all nodes', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);

    expect(results.nodeResults['inf']).toBeDefined();
    expect(results.nodeResults['pc']).toBeDefined();
    expect(results.nodeResults['aer']).toBeDefined();
    expect(results.nodeResults['sc']).toBeDefined();
    expect(results.nodeResults['eff']).toBeDefined();
  });

  it('effluent has lower COD/BOD/NH3/TSS than influent', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);

    const infWQ = results.nodeResults['inf'].outputs['out'];
    const effWQ = results.nodeResults['eff'].outputs['out'];

    expect(effWQ.COD).toBeLessThan(infWQ.COD);
    expect(effWQ.BOD5).toBeLessThan(infWQ.BOD5);
    expect(effWQ.NH3N).toBeLessThan(infWQ.NH3N);
    expect(effWQ.TSS).toBeLessThan(infWQ.TSS);
  });

  it('effluent TSS is very low (secondary clarifier effect)', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);
    const effWQ = results.nodeResults['eff'].outputs['out'];

    expect(effWQ.TSS).toBeLessThan(30); // should be < 30 mg/L
  });

  it('nitrification produces NO3 from NH3', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);
    const effWQ = results.nodeResults['eff'].outputs['out'];

    expect(effWQ.NO3N).toBeGreaterThan(15); // significant nitrification
    expect(effWQ.NH3N).toBeLessThan(3); // most NH3 oxidised
  });

  it('compliance check passes for typical SA discharge standards', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);
    const effWQ = results.nodeResults['eff'].outputs['out'] as WaterQuality;

    const standards: DischargeStandards = {
      COD: 75,
      BOD5: 10,
      NH3N: 6,
      TSS: 25,
    };

    const compliance = checkCompliance(effWQ, standards);
    // NH3 and TSS should pass with good nitrification and clarification
    expect(compliance.NH3N.pass).toBe(true);
    expect(compliance.TSS.pass).toBe(true);
  });
});

describe('v2 outputs — full train', () => {
  it('every node in a simulated conventional AS train emits v2 outputs', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);
    for (const nodeResult of Object.values(results.nodeResults)) {
      assertValidV2Outputs(nodeResult as ProcessResult);
    }
  });
});

describe('v2 content — full AS train', () => {
  it('produces real sizing, energy, BoQ, and calc records end-to-end', () => {
    const { nodes, edges } = conventionalASFlowsheet();
    const results = simulate(nodes, edges);

    let totalCapex = 0;
    let totalKW = 0;
    let totalRecordCount = 0;
    for (const nodeResult of Object.values(results.nodeResults)) {
      const r = nodeResult as ProcessResult;
      if (r.capex?.total) totalCapex += r.capex.total;
      if (r.energy?.installedKW) totalKW += r.energy.installedKW;
      if (r.calculationRecords) {
        totalRecordCount += r.calculationRecords.length;
        assertAllRecordsValid(r.calculationRecords);
      }
    }

    expect(totalCapex).toBeGreaterThan(1_000_000);
    expect(totalKW).toBeGreaterThanOrEqual(0);
    expect(totalRecordCount).toBeGreaterThan(10);
  });
});

// ── Simple 2-node: Influent → Effluent ──────────────────────
describe('Simulator: Simple pass-through', () => {
  it('passes influent straight to effluent', () => {
    const nodes: GraphNode[] = [
      {
        id: 'inf', type: 'processUnit',
        data: { unitType: 'influent', parameters: { flow: 5000, COD: 300 } },
      },
      {
        id: 'eff', type: 'processUnit',
        data: { unitType: 'effluent', parameters: {} },
      },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'inf', target: 'eff', sourceHandle: 'out', targetHandle: 'in' },
    ];

    const results = simulate(nodes, edges);
    expect(results.converged).toBe(true);
    expect(results.nodeResults['eff'].outputs['out'].COD).toBe(300);
    expect(results.nodeResults['eff'].outputs['out'].flow).toBe(5000);
  });
});

// ── Splitter + Mixer mass balance ───────────────────────────
describe('Simulator: Splitter → Mixer mass balance', () => {
  it('preserves total flow and mass through split-merge', () => {
    const nodes: GraphNode[] = [
      {
        id: 'inf', type: 'processUnit',
        data: { unitType: 'influent', parameters: { flow: 10000, COD: 400 } },
      },
      {
        id: 'split', type: 'processUnit',
        data: { unitType: 'splitter', parameters: { split_ratio: 0.6 } },
      },
      {
        id: 'mix', type: 'processUnit',
        data: { unitType: 'mixer', parameters: {} },
      },
      {
        id: 'eff', type: 'processUnit',
        data: { unitType: 'effluent', parameters: {} },
      },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'inf', target: 'split', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'split', target: 'mix', sourceHandle: 'main', targetHandle: 'in' },
      { id: 'e3', source: 'split', target: 'mix', sourceHandle: 'side', targetHandle: 'in' },
      { id: 'e4', source: 'mix', target: 'eff', sourceHandle: 'out', targetHandle: 'in' },
    ];

    const results = simulate(nodes, edges);
    const effWQ = results.nodeResults['eff'].outputs['out'];

    expect(effWQ.flow).toBeCloseTo(10000, 0);
    expect(effWQ.COD).toBeCloseTo(400, 0);
  });
});

// ── Full plant with Phase 2 units ─────────────────────────────
describe('Full plant with Phase 2 units', () => {
  it('runs end-to-end with non-zero totals from every category', () => {
    const nodes: GraphNode[] = [
      {
        id: 'inf', type: 'processUnit',
        data: { unitType: 'influent', parameters: { flow: 1000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, NO3N: 0.5, TP: 8, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, DO: 0, temperature: 20 } },
      },
      {
        id: 'pump', type: 'processUnit',
        data: { unitType: 'inlet_pumping', parameters: { tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5, wet_well_hrt_min: 10 } },
      },
      {
        id: 'screen', type: 'processUnit',
        data: { unitType: 'screen', parameters: { screen_type: 1, bar_spacing_mm: 3, approach_velocity_mps: 0.6, peak_factor: 2.5, channel_depth_m: 1.0 } },
      },
      {
        id: 'grit', type: 'processUnit',
        data: { unitType: 'grit_removal', parameters: { hrt_min: 4, peak_factor: 2.5 } },
      },
      {
        id: 'eq', type: 'processUnit',
        data: { unitType: 'equalisation_tank', parameters: { hrt_hours: 6, depth: 4.5 } },
      },
      {
        id: 'pc', type: 'processUnit',
        data: { unitType: 'primary_clarifier', parameters: { tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 60, depth: 3.5, uo_ratio: 0.05 } },
      },
      {
        id: 'aer', type: 'processUnit',
        data: { unitType: 'bioreactor_aerobic', parameters: { volume: 500, depth: 4.5, do_setpoint: 2, srt: 12, yield_obs: 0.45, nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06 } },
      },
      {
        id: 'sc', type: 'processUnit',
        data: { unitType: 'secondary_clarifier', parameters: { surface_area: 100, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75 } },
      },
      {
        id: 'uv', type: 'processUnit',
        data: { unitType: 'uv_disinfection', parameters: { required_dose_mj_cm2: 40 } },
      },
      {
        id: 'eff', type: 'processUnit',
        data: { unitType: 'effluent', parameters: {} },
      },
      {
        id: 'blower', type: 'processUnit',
        data: { unitType: 'aeration_blower', parameters: { o2_demand_kg_per_day: 400, ote: 0.08, diffuser_depth_m: 4.5 } },
      },
      {
        id: 'dose', type: 'processUnit',
        data: { unitType: 'chemical_dosing', parameters: { chemical_type: 0, dose_mg_per_L: 30, storage_days: 7 } },
      },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'inf', target: 'pump', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'pump', target: 'screen', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e3', source: 'screen', target: 'grit', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e4', source: 'grit', target: 'eq', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e5', source: 'eq', target: 'pc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e6', source: 'pc', target: 'aer', sourceHandle: 'overflow', targetHandle: 'in' },
      { id: 'e7', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e8', source: 'sc', target: 'uv', sourceHandle: 'overflow', targetHandle: 'in' },
      { id: 'e9', source: 'uv', target: 'eff', sourceHandle: 'out', targetHandle: 'in' },
    ];

    const results = simulate(nodes, edges);

    let totalCapex = 0;
    let totalKW = 0;
    let totalRecords = 0;
    const categoriesSeen = new Set<string>();
    for (const nodeResult of Object.values(results.nodeResults)) {
      const r = nodeResult as ProcessResult;
      if (r.capex?.total) totalCapex += r.capex.total;
      if (r.energy?.installedKW) totalKW += r.energy.installedKW;
      if (r.calculationRecords) totalRecords += r.calculationRecords.length;
      r.capex?.lineItems?.forEach(i => categoriesSeen.add(i.category));
    }

    expect(totalCapex).toBeGreaterThan(5_000_000);
    expect(totalKW).toBeGreaterThan(10);
    expect(totalRecords).toBeGreaterThan(20);
    expect(categoriesSeen.has('civil')).toBe(true);
    expect(categoriesSeen.has('mechanical')).toBe(true);
  });
});
