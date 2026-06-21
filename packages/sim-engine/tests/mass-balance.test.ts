import { describe, it, expect } from 'vitest';
import { simulate } from '../src/graph/simulator';
import { computeMassBalanceLedger } from '../src/graph/mass-balance';
import type { ComponentBalance, NodeLedger, PlantClosure } from '../src/graph/mass-balance';
import type { GraphNode, GraphEdge } from '../src/graph/topological-sort';

/**
 * Phase 2e acceptance — plant mass-balance ledger over a simulated stream graph.
 *
 * The ledger is a REPORTING layer: flow must conserve (~100% closure) everywhere
 * (no flow created or destroyed except where a split feeds an unconnected handle),
 * while COD/N/P show real treatment removal, which the ledger reports rather than
 * requiring it to close.
 *
 * Two flowsheets are exercised:
 *  - bareChain (influent -> bioreactor_aerobic -> effluent): the brief's example.
 *    Flow closes at every node and plant-wide. The aerobic reactor reports real
 *    nitrogen removal (TKN assimilated into biomass per Marais-Ekama). NOTE: its
 *    mixed-liquor effluent CARRIES biomass as MLSS, so COD accumulates in the
 *    stream here — COD removal only realises once solids are wasted at a clarifier.
 *  - clarifierChain (... -> secondary_clarifier -> effluent): adds the solids
 *    separation that wastes biomass out an unconnected underflow handle, so the
 *    ledger reports genuine COD removal at the clarifier node and plant-wide.
 */

function balanceFor(ledger: NodeLedger | undefined, component: string): ComponentBalance | undefined {
  return ledger?.balances.find((b) => b.component === component);
}

function plantFor(plant: PlantClosure[], component: string): PlantClosure | undefined {
  return plant.find((p) => p.component === component);
}

function influentNode(id: string): GraphNode {
  return {
    id,
    type: 'processUnit',
    data: {
      unitType: 'influent',
      parameters: {
        flow: 1000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, NO3N: 0.5,
        TP: 8, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, DO: 0, temperature: 20,
      },
    },
  };
}

function aerobicNode(id: string): GraphNode {
  return {
    id,
    type: 'processUnit',
    data: { unitType: 'bioreactor_aerobic', parameters: { srt: 15, mlss: 4000, do_setpoint: 2 } },
  };
}

function effluentNode(id: string): GraphNode {
  return { id, type: 'processUnit', data: { unitType: 'effluent', parameters: {} } };
}

function bareChain(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [influentNode('inf'), aerobicNode('aer'), effluentNode('eff')];
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'inf', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e2', source: 'aer', target: 'eff', sourceHandle: 'out', targetHandle: 'in' },
  ];
  return { nodes, edges };
}

function clarifierChain(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    influentNode('inf'),
    aerobicNode('aer'),
    {
      id: 'sc',
      type: 'processUnit',
      data: { unitType: 'secondary_clarifier', parameters: { surface_area: 800, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75 } },
    },
    effluentNode('eff'),
  ];
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'inf', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e2', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
    // Only the clarified overflow is drawn to the effluent; the underflow solids
    // leave via an unconnected handle (the documented exception to flow closure).
    { id: 'e3', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
  ];
  return { nodes, edges };
}

describe('Phase 2e — plant mass-balance ledger', () => {
  it('(a) every node has a flow balance with ~100% closure (flow conserved)', () => {
    const { nodes, edges } = bareChain();
    const results = simulate(nodes, edges);
    expect(results.converged).toBe(true);

    const ledger = computeMassBalanceLedger(nodes, edges, results);
    expect(ledger.nodes).toHaveLength(nodes.length);

    for (const nodeLedger of ledger.nodes) {
      const flow = balanceFor(nodeLedger, 'flow');
      expect(flow, `${nodeLedger.nodeId} flow balance`).toBeDefined();
      expect(flow!.closurePct, `${nodeLedger.nodeId} flow closure`).toBeCloseTo(100, 6);
    }

    // worstNodeClosurePct tracks the flow closure furthest from 100; flow conserves.
    expect(ledger.worstNodeClosurePct).toBeCloseTo(100, 6);
  });

  it('(b) the aerobic node reports real removal (TKN assimilated into biomass)', () => {
    const { nodes, edges } = bareChain();
    const results = simulate(nodes, edges);

    const ledger = computeMassBalanceLedger(nodes, edges, results);
    const aer = ledger.nodes.find((n) => n.nodeId === 'aer');
    expect(aer).toBeDefined();

    const tkn = balanceFor(aer, 'TKN');
    expect(tkn).toBeDefined();
    expect(tkn!.inLoad).toBeGreaterThan(0);
    expect(tkn!.removedLoad, 'aerobic TKN removed').toBeGreaterThan(0);
    expect(tkn!.outLoad).toBeLessThan(tkn!.inLoad);
  });

  it('(c) plant flow closes ~100% on the brief example chain', () => {
    const { nodes, edges } = bareChain();
    const results = simulate(nodes, edges);

    const ledger = computeMassBalanceLedger(nodes, edges, results);

    const plantFlow = plantFor(ledger.plant, 'flow');
    expect(plantFlow).toBeDefined();
    expect(plantFlow!.influentLoad).toBeCloseTo(1000, 6);
    expect(plantFlow!.closurePct).toBeCloseTo(100, 6);
  });

  it('reports genuine COD removal at the clarifier node when solids are wasted', () => {
    const { nodes, edges } = clarifierChain();
    const results = simulate(nodes, edges);
    expect(results.converged).toBe(true);

    const ledger = computeMassBalanceLedger(nodes, edges, results);
    const sc = ledger.nodes.find((n) => n.nodeId === 'sc');
    expect(sc).toBeDefined();

    const cod = balanceFor(sc, 'COD');
    expect(cod).toBeDefined();
    expect(cod!.inLoad).toBeGreaterThan(0);
    // Biomass COD leaves with the wasted underflow solids — real removal here.
    expect(cod!.removedLoad, 'clarifier COD removed').toBeGreaterThan(0);
    expect(cod!.outLoad).toBeLessThan(cod!.inLoad);

    // Plant-wide influent COD load = 500 mg/L x 1000 m3/d / 1000 = 500 kg/d, and
    // the effluent carries far less (real plant COD removal reported, not closed).
    const plantCod = plantFor(ledger.plant, 'COD');
    expect(plantCod).toBeDefined();
    expect(plantCod!.influentLoad).toBeCloseTo(500, 6);
    expect(plantCod!.removedOrAccumulatedLoad).toBeGreaterThan(0);
    expect(plantCod!.effluentLoad).toBeLessThan(plantCod!.influentLoad);
  });

  it('flow does NOT close at the clarifier (underflow is an unconnected split handle)', () => {
    const { nodes, edges } = clarifierChain();
    const results = simulate(nodes, edges);

    const ledger = computeMassBalanceLedger(nodes, edges, results);
    const sc = ledger.nodes.find((n) => n.nodeId === 'sc');
    const flow = balanceFor(sc, 'flow');
    expect(flow).toBeDefined();
    // Only the overflow is counted (underflow feeds no downstream edge), so the
    // node intentionally shows < 100% flow closure — the documented exception.
    expect(flow!.closurePct).toBeLessThan(100);
    expect(flow!.removedLoad).toBeGreaterThan(0);
  });
});
