import { describe, it, expect } from 'vitest';
import { evaluatePlant } from '../src/engine/evaluate';
import type { GraphDefinition } from '../src/engine/evaluate';

/**
 * Flow-conservation acceptance suite.
 *
 * THE INVARIANT: effluent flow can never exceed influent flow. Water is conserved
 * — it leaves only as a little waste sludge / reject / cake. A recycle line (IMLR,
 * RAS, filtrate return) returns flow INTERNALLY and must never add to the net flow
 * discharged. The bug this guards against: a 6× recycle drawn off a separator's
 * reject handle inflated a 40 m³/d plant's effluent to ~274 m³/d (685% flow
 * closure) because the separator's product handle was never reduced by the recycle.
 */

const node = (id: string, unitType: string, parameters: Record<string, number> = {}) =>
  ({ id, type: 'processUnit', data: { unitType, parameters } });
const edge = (id: string, source: string, target: string, sourceHandle: string, recycleRatio?: number) =>
  ({ id, source, target, sourceHandle, targetHandle: 'in', ...(recycleRatio !== undefined ? { recycleRatio } : {}) });

const flowClosurePct = (r: ReturnType<typeof evaluatePlant>) =>
  r.ledger.plant.find((p) => p.component === 'flow')!.closurePct;

describe('Flow conservation — effluent never exceeds influent (recycle stays internal)', () => {
  it('REGRESSION: MLE-MBR with a 6× recycle off the MBR reject does NOT discharge ~274 m³/d', () => {
    // The exact reported topology: influent 40, anoxic → aerobic → MBR → effluent,
    // with the recirculation drawn off the MBR reject back to the anoxic at 6×.
    const graph: GraphDefinition = {
      nodes: [
        node('inf', 'influent', { flow: 40, COD: 800, TKN: 50, NH3N: 35, TSS: 400, temperature: 15 }),
        node('anx', 'bioreactor_anoxic', { anoxic_fraction: 0.3, srt: 15 }),
        node('aer', 'bioreactor_aerobic', { srt: 15, mlss: 12000 }),
        node('mbr', 'mbr', {}),
        node('eff', 'effluent', {}),
      ],
      edges: [
        edge('f1', 'inf', 'anx', 'out'),
        edge('f2', 'anx', 'aer', 'out'),
        edge('f3', 'aer', 'mbr', 'out'),
        edge('p', 'mbr', 'eff', 'permeate'),
        edge('ras', 'mbr', 'anx', 'reject', 6), // recirculation: 6 × feed
      ],
    };
    const r = evaluatePlant(graph);
    expect(r.effluentStream).not.toBeNull();
    // The headline assertion: nowhere near 274 — it is the net feed (~40), not 7× it.
    expect(r.effluentStream!.flow).toBeLessThan(45);
    expect(r.effluentStream!.flow).toBeGreaterThan(35);
    // Flow closure is ~100%, not ~685%.
    expect(flowClosurePct(r)).toBeGreaterThan(90);
    expect(flowClosurePct(r)).toBeLessThan(110);
  });

  it('clean MLE-MBR (IMLR off the aerobic reactor) discharges ≈ the feed', () => {
    const graph: GraphDefinition = {
      nodes: [
        node('inf', 'influent', { flow: 40, COD: 800, TKN: 50, NH3N: 35, TSS: 400, temperature: 15 }),
        node('anx', 'bioreactor_anoxic', { anoxic_fraction: 0.3, srt: 15 }),
        node('aer', 'bioreactor_aerobic', { srt: 15, mlss: 12000 }),
        node('mbr', 'mbr', {}),
        node('eff', 'effluent', {}),
      ],
      edges: [
        edge('f1', 'inf', 'anx', 'out'),
        edge('f2', 'anx', 'aer', 'out'),
        edge('f3', 'aer', 'mbr', 'out'),
        edge('p', 'mbr', 'eff', 'permeate'),
        edge('imlr', 'aer', 'anx', 'out', 4), // internal mixed-liquor recycle 4×
      ],
    };
    const r = evaluatePlant(graph);
    // ~0.98 × 40 (2% leaves as MBR reject), never above the feed.
    expect(r.effluentStream!.flow).toBeLessThanOrEqual(40 + 1e-3);
    expect(r.effluentStream!.flow).toBeGreaterThan(38);
  });

  it('AS + secondary clarifier with RAS keeps the recycle internal (effluent ≈ feed)', () => {
    const graph: GraphDefinition = {
      nodes: [
        node('inf', 'influent', { flow: 1000, COD: 600, TKN: 45, NH3N: 30, TSS: 300, temperature: 18 }),
        node('aer', 'bioreactor_aerobic', { srt: 12, mlss: 4000 }),
        node('sc', 'secondary_clarifier', { uo_ratio: 0.75 }),
        node('eff', 'effluent', {}),
      ],
      edges: [
        edge('f1', 'inf', 'aer', 'out'),
        edge('f2', 'aer', 'sc', 'out'),
        edge('o', 'sc', 'eff', 'overflow'),
        edge('ras', 'sc', 'aer', 'underflow', 0.75), // RAS 0.75 × feed
      ],
    };
    const r = evaluatePlant(graph);
    expect(r.effluentStream!.flow).toBeLessThanOrEqual(1000 + 1);
    expect(r.effluentStream!.flow).toBeGreaterThan(900);
    expect(flowClosurePct(r)).toBeGreaterThan(90);
    expect(flowClosurePct(r)).toBeLessThan(110);
  });

  it('MLE + SC with BOTH an IMLR and a RAS recycle still discharges ≈ feed', () => {
    const graph: GraphDefinition = {
      nodes: [
        node('inf', 'influent', { flow: 2000, COD: 700, TKN: 50, NH3N: 35, TSS: 350, temperature: 16 }),
        node('anx', 'bioreactor_anoxic', { anoxic_fraction: 0.3, srt: 15 }),
        node('aer', 'bioreactor_aerobic', { srt: 15, mlss: 4000 }),
        node('sc', 'secondary_clarifier', { uo_ratio: 0.75 }),
        node('eff', 'effluent', {}),
      ],
      edges: [
        edge('f1', 'inf', 'anx', 'out'),
        edge('f2', 'anx', 'aer', 'out'),
        edge('f3', 'aer', 'sc', 'out'),
        edge('o', 'sc', 'eff', 'overflow'),
        edge('imlr', 'aer', 'anx', 'out', 4),       // a-recycle 4×
        edge('ras', 'sc', 'anx', 'underflow', 0.75), // RAS 0.75×
      ],
    };
    const r = evaluatePlant(graph);
    expect(r.effluentStream!.flow).toBeLessThanOrEqual(2000 + 1);
    expect(r.effluentStream!.flow).toBeGreaterThan(1800);
    expect(flowClosurePct(r)).toBeGreaterThan(90);
    expect(flowClosurePct(r)).toBeLessThan(110);
  });

  it('linear chain with an unconnected clarifier sludge line still wastes that sludge (effluent < influent)', () => {
    // No recycle. The clarifier's underflow pipe is not drawn, but the sludge it
    // separates must still leave — the overflow is inflow − sludge, not inflow.
    const graph: GraphDefinition = {
      nodes: [
        node('inf', 'influent', { flow: 5000, COD: 600, TSS: 300, temperature: 18 }),
        node('pc', 'primary_clarifier', { uo_ratio: 0.05 }),
        node('eff', 'effluent', {}),
      ],
      edges: [
        edge('f1', 'inf', 'pc', 'out'),
        edge('o', 'pc', 'eff', 'overflow'),
        // underflow intentionally unconnected
      ],
    };
    const r = evaluatePlant(graph);
    expect(r.effluentStream!.flow).toBeLessThan(5000);   // sludge removed
    expect(r.effluentStream!.flow).toBeGreaterThan(4500); // but most water discharged
  });
});
