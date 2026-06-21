import { describe, it, expect } from 'vitest';
import { simulate } from '../src/graph/simulator';
import type { GraphNode, GraphEdge } from '../src/graph/topological-sort';
import type { WaterQuality } from '../src/types';

/**
 * Phase 1 acceptance check — connected stream-graph propagation.
 *
 * Proves the core defect is fixed: every block's influent is exactly the prior
 * block's effluent (streams are connected), junctions/splits behave, and a
 * cyclic graph (RAS / internal recycle) converges by real propagation rather
 * than a frozen global "Q_basis" pin.
 */

const WQ_KEYS: (keyof WaterQuality)[] = [
  'flow', 'COD', 'sCOD', 'BOD5', 'TKN', 'NH3N', 'NO3N', 'TP', 'TSS', 'VSS', 'pH', 'alkalinity', 'DO', 'temperature',
];

/** Assert two streams are equal field-by-field (continuity of a connected edge). */
function expectStreamsEqual(a: WaterQuality, b: WaterQuality, label: string) {
  for (const k of WQ_KEYS) {
    expect(a[k], `${label}: ${k}`).toBeCloseTo(b[k], 6);
  }
}

function influentNode(id: string, flow: number): GraphNode {
  return {
    id, type: 'processUnit',
    data: {
      unitType: 'influent',
      parameters: {
        flow, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, NO3N: 0.5,
        TP: 8, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, DO: 0, temperature: 20,
      },
    },
  };
}

const anoxic = (id: string): GraphNode => ({
  id, type: 'processUnit',
  data: { unitType: 'bioreactor_anoxic', parameters: { volume: 1500, depth: 4.5, denitrification_eff: 85, cod_n_ratio: 6 } },
});
const aerobic = (id: string): GraphNode => ({
  id, type: 'processUnit',
  data: { unitType: 'bioreactor_aerobic', parameters: { volume: 5000, srt: 12, do_setpoint: 2, yield_obs: 0.45, nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06, depth: 4.5 } },
});
const secClarifier = (id: string): GraphNode => ({
  id, type: 'processUnit',
  data: { unitType: 'secondary_clarifier', parameters: { surface_area: 800, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75 } },
});
const effluentNode = (id: string): GraphNode => ({ id, type: 'processUnit', data: { unitType: 'effluent', parameters: {} } });

// ── 1c.1 — Linear chain continuity ──────────────────────────────────────────
describe('Phase 1c — linear chain: each block influent equals prior effluent', () => {
  function linearChain(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [
      influentNode('inf', 10000),
      {
        id: 'pc', type: 'processUnit',
        data: { unitType: 'primary_clarifier', parameters: { tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 } },
      },
      aerobic('aer'),
      secClarifier('sc'),
      effluentNode('eff'),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'inf', target: 'pc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'pc', target: 'aer', sourceHandle: 'overflow', targetHandle: 'in' },
      { id: 'e3', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e4', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
    ];
    return { nodes, edges };
  }

  it('every connected edge carries exactly the upstream block effluent (stream table)', () => {
    const { nodes, edges } = linearChain();
    const r = simulate(nodes, edges);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(1); // pure DAG: one forward sweep is exact

    // The chain of (edge, sourceNode, sourceHandle): the edge stream must equal
    // the source block's output on that handle, and is exactly what the target
    // block consumes — proving influent(block) === effluent(prior block).
    const links: Array<[string, string, string, string]> = [
      // edgeId, sourceNode, sourceHandle, targetNode
      ['e1', 'inf', 'out', 'pc'],
      ['e2', 'pc', 'overflow', 'aer'],
      ['e3', 'aer', 'out', 'sc'],
      ['e4', 'sc', 'overflow', 'eff'],
    ];

    const table: Record<string, Record<string, number>> = {};
    for (const [edgeId, src, handle, tgt] of links) {
      const edgeStream = r.edgeResults[edgeId]!;
      const sourceEffluent = r.nodeResults[src]!.outputs[handle]!;
      expectStreamsEqual(edgeStream, sourceEffluent, `${src}.${handle} -> ${tgt} (${edgeId})`);
      table[`${src}.${handle} → ${tgt}`] = {
        flow: Math.round(edgeStream.flow),
        COD: Math.round(edgeStream.COD),
        BOD5: Math.round(edgeStream.BOD5),
        NH3N: Math.round(edgeStream.NH3N * 10) / 10,
        NO3N: Math.round(edgeStream.NO3N * 10) / 10,
        TSS: Math.round(edgeStream.TSS),
      };
    }
    // Print the continuity stream table (visible in vitest output).
    // eslint-disable-next-line no-console
    console.table(table);

    // Effluent COD/NH3/TSS must be below influent (treatment actually happened).
    const inf = r.nodeResults['inf']!.outputs['out']!;
    const eff = r.nodeResults['eff']!.outputs['out']!;
    expect(eff.COD).toBeLessThan(inf.COD);
    expect(eff.NH3N).toBeLessThan(inf.NH3N);
    expect(eff.TSS).toBeLessThan(inf.TSS);
  });
});

// ── 1c.2 — RAS / IMLR recycle convergence ────────────────────────────────────
describe('Phase 1c — cyclic graph converges by propagation (RAS + IMLR)', () => {
  function bnrWithRecycles(rawFlow: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [
      influentNode('inf', rawFlow),
      anoxic('anx'),
      aerobic('aer'),
      secClarifier('sc'),
      effluentNode('eff'),
    ];
    const edges: GraphEdge[] = [
      { id: 'feed', source: 'inf', target: 'anx', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'anx_aer', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'aer_sc', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'sc_eff', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
      // Internal mixed-liquor recycle: aerobic outlet back to anoxic, 4× influent.
      { id: 'imlr', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 4 },
      // RAS: clarifier underflow back to anoxic, 0.75× influent.
      { id: 'ras', source: 'sc', target: 'anx', sourceHandle: 'underflow', targetHandle: 'in', recycleRatio: 0.75 },
    ];
    return { nodes, edges };
  }

  it('converges in >1 sweep, and recycle flows track the local influent', () => {
    const raw = 1000;
    const { nodes, edges } = bnrWithRecycles(raw);
    const r = simulate(nodes, edges);

    expect(r.converged).toBe(true);
    expect(r.iterations).toBeGreaterThan(1); // it genuinely iterated (not a frozen pin)
    expect(r.iterations).toBeLessThan(50);

    // Recycle flows built up to ratio × the local fresh influent (1000), not a
    // frozen guess and not zero.
    expect(r.edgeResults['imlr']!.flow).toBeCloseTo(4 * raw, 0);
    expect(r.edgeResults['ras']!.flow).toBeCloseTo(0.75 * raw, 0);

    // The anoxic reactor actually SEES the elevated throughput: its outlet flow
    // equals raw + IMLR + RAS (mass balance through the reactor).
    const anxOut = r.edgeResults['anx_aer']!.flow;
    expect(anxOut).toBeCloseTo(raw + 4 * raw + 0.75 * raw, 0);

    // Effluent flow ≈ raw influent (the recycles stay inside the loop).
    const effFlow = r.nodeResults['eff']!.outputs['out']!.flow;
    expect(effFlow).toBeGreaterThan(0.9 * raw);
    expect(effFlow).toBeLessThan(1.1 * raw);
  });

  it('is deterministic: re-running gives byte-identical streams', () => {
    const { nodes, edges } = bnrWithRecycles(1000);
    const a = simulate(nodes, edges);
    const b = simulate(nodes, edges);
    for (const id of Object.keys(a.edgeResults)) {
      expectStreamsEqual(a.edgeResults[id]!, b.edgeResults[id]!, `edge ${id}`);
    }
  });
});

// ── 1c.3 — Local recycle basis (the old global Q_basis would be wrong) ────────
describe('Phase 1c — recycle is local, not a global influent sum', () => {
  it('two independent trains: each recycle scales off its OWN influent', () => {
    // Train A fed at 1000, Train B fed at 500, each with an IMLR at ratio 3.
    // Old global Q_basis = 1500 would give BOTH recycles 3×1500 = 4500 (wrong).
    // Local model gives A: 3×1000 = 3000, B: 3×500 = 1500.
    const nodes: GraphNode[] = [
      influentNode('infA', 1000), anoxic('anxA'), aerobic('aerA'), secClarifier('scA'), effluentNode('effA'),
      influentNode('infB', 500), anoxic('anxB'), aerobic('aerB'), secClarifier('scB'), effluentNode('effB'),
    ];
    const edges: GraphEdge[] = [
      { id: 'a_feed', source: 'infA', target: 'anxA', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'a1', source: 'anxA', target: 'aerA', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'a2', source: 'aerA', target: 'scA', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'a3', source: 'scA', target: 'effA', sourceHandle: 'overflow', targetHandle: 'in' },
      { id: 'a_imlr', source: 'aerA', target: 'anxA', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 3 },
      { id: 'b_feed', source: 'infB', target: 'anxB', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'b1', source: 'anxB', target: 'aerB', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'b2', source: 'aerB', target: 'scB', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'b3', source: 'scB', target: 'effB', sourceHandle: 'overflow', targetHandle: 'in' },
      { id: 'b_imlr', source: 'aerB', target: 'anxB', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 3 },
    ];

    const r = simulate(nodes, edges);
    expect(r.converged).toBe(true);
    expect(r.edgeResults['a_imlr']!.flow).toBeCloseTo(3 * 1000, 0); // local, not 4500
    expect(r.edgeResults['b_imlr']!.flow).toBeCloseTo(3 * 500, 0);  // local, not 4500
  });
});
