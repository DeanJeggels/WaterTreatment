import { describe, it, expect } from 'vitest';
import { simulate } from '../src/graph/simulator';
import { computeMassBalanceLedger } from '../src/graph/mass-balance';
import { delegateMleDesign } from '../src/graph/recognise-mle-train';
import type { GraphNode, GraphEdge } from '../src/graph/topological-sort';

/**
 * Phase 2 acceptance (brief 2e): re-run a plant on the kernel-driven blocks and
 * show (a) a full per-node mass-balance ledger + plant-wide closure, and
 * (b) the sized geometry of every block. Plus the Phase-2.4 delegate returning
 * the EXACT WWTP Design.xlsm numbers for a recognised MLE/MBR train.
 */

// Fully-connected activated-sludge loop (RAS closes the underflow, so flow
// closes 100% at every node — the clean closure demonstration).
function asLoopWithRas(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    {
      id: 'inf', type: 'processUnit',
      data: { unitType: 'influent', parameters: { flow: 10000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, NO3N: 0.5, TP: 8, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, DO: 0, temperature: 20 } },
    },
    { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt: 15, mlss: 4000, do_setpoint: 2 } } },
    { id: 'sc', type: 'processUnit', data: { unitType: 'secondary_clarifier', parameters: { surface_area: 1200, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75 } } },
    { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
  ];
  const edges: GraphEdge[] = [
    { id: 'feed', source: 'inf', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'aer_sc', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'sc_eff', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
    { id: 'ras', source: 'sc', target: 'aer', sourceHandle: 'underflow', targetHandle: 'in', recycleRatio: 0.75 },
  ];
  return { nodes, edges };
}

describe('Phase 2e — mass-balance ledger + plant-wide closure + sized geometry', () => {
  it('flow closes ~100% at every node of a fully-connected AS loop', () => {
    const { nodes, edges } = asLoopWithRas();
    const results = simulate(nodes, edges);
    expect(results.converged).toBe(true);

    const ledger = computeMassBalanceLedger(nodes, edges, results);

    // Print the per-node flow ledger (visible in vitest output).
    const flowTable: Record<string, Record<string, number>> = {};
    for (const n of ledger.nodes) {
      const flow = n.balances.find(b => b.component === 'flow')!;
      const cod = n.balances.find(b => b.component === 'COD')!;
      const tkn = n.balances.find(b => b.component === 'TKN')!;
      flowTable[`${n.nodeId} (${n.unitType})`] = {
        flowIn: Math.round(flow.inLoad),
        flowOut: Math.round(flow.outLoad),
        flowClosure_pct: Math.round(flow.closurePct * 10) / 10,
        COD_removed_kgd: Math.round(cod.removedLoad),
        TKN_removed_kgd: Math.round(tkn.removedLoad * 10) / 10,
      };
    }
    // eslint-disable-next-line no-console
    console.table(flowTable);

    // Every node's flow closes (all handles connected → no flow lost).
    for (const n of ledger.nodes) {
      const flow = n.balances.find(b => b.component === 'flow')!;
      expect(flow.closurePct, `${n.nodeId} flow closure`).toBeGreaterThan(99.5);
      expect(flow.closurePct, `${n.nodeId} flow closure`).toBeLessThan(100.5);
    }
    expect(ledger.worstNodeClosurePct).toBeGreaterThan(99.5);
  });

  it('plant-wide flow conserved + COD/TKN removed; aerobic flags recycle-coupled sizing', () => {
    const { nodes, edges } = asLoopWithRas();
    const results = simulate(nodes, edges);
    const ledger = computeMassBalanceLedger(nodes, edges, results);

    const plantFlow = ledger.plant.find(p => p.component === 'flow')!;
    const plantCOD = ledger.plant.find(p => p.component === 'COD')!;
    const plantTKN = ledger.plant.find(p => p.component === 'TKN')!;

    // eslint-disable-next-line no-console
    console.table({
      flow: { in: Math.round(plantFlow.influentLoad), out: Math.round(plantFlow.effluentLoad), closure_pct: Math.round(plantFlow.closurePct * 10) / 10 },
      COD_kgd: { in: Math.round(plantCOD.influentLoad), out: Math.round(plantCOD.effluentLoad), removed_pct: Math.round((plantCOD.removedOrAccumulatedLoad / plantCOD.influentLoad) * 100) },
      TKN_kgd: { in: Math.round(plantTKN.influentLoad * 10) / 10, out: Math.round(plantTKN.effluentLoad * 10) / 10, removed_pct: Math.round((plantTKN.removedOrAccumulatedLoad / plantTKN.influentLoad) * 100) },
    });

    expect(plantFlow.closurePct).toBeGreaterThan(99.5); // flow conserved end-to-end
    expect(plantCOD.effluentLoad).toBeLessThan(plantCOD.influentLoad); // COD removed
    expect(plantTKN.effluentLoad).toBeLessThan(plantTKN.influentLoad); // N removed

    // The aerobic block is fed RAS (mixed liquor), so it correctly flags that its
    // standalone sludge-mass sizing over-estimates and the whole-reactor (MLE)
    // design should size it. (Recycle-coupled sizing belongs to the delegate.)
    const aerWarnings = results.nodeResults['aer']!.warnings ?? [];
    expect(aerWarnings.some(w => /recycle-coupled/i.test(w))).toBe(true);
  });

  it('single-pass aerobic self-sizes to a sane volume (HRT in a realistic band)', () => {
    // No recycle: the aerobic block is fed the fresh feed, so FSi = COD_raw x Q_raw
    // and the Marais-Ekama self-sizing is valid.
    const nodes: GraphNode[] = [
      { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 10000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, NO3N: 0.5, TP: 8, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, DO: 0, temperature: 20 } } },
      { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt: 15, mlss: 4000, do_setpoint: 2 } } },
      { id: 'sc', type: 'processUnit', data: { unitType: 'secondary_clarifier', parameters: { surface_area: 1200, depth: 4, tss_removal: 99.5, uo_ratio: 0.75 } } },
      { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
    ];
    const edges: GraphEdge[] = [
      { id: 'feed', source: 'inf', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'aer_sc', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'sc_eff', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
    ];
    const results = simulate(nodes, edges);
    const aerSizing = results.nodeResults['aer']!.sizing!;
    // eslint-disable-next-line no-console
    console.log('Single-pass aerobic sizing:', JSON.stringify({
      requiredVolumeM3: Math.round(aerSizing.requiredVolume!.value),
      HRT_h: Math.round(aerSizing.HRT!.value * 10) / 10,
      MLSS: aerSizing.MLSS!.value,
      blowerKW: Math.round(aerSizing.blowerKW!.value * 10) / 10,
    }, null, 2));

    const hrt = aerSizing.HRT!.value;
    expect(hrt).toBeGreaterThan(4);   // sane conventional-AS aeration HRT band
    expect(hrt).toBeLessThan(48);
    // and NOT flagged as recycle-coupled (fresh feed)
    const aerWarnings = results.nodeResults['aer']!.warnings ?? [];
    expect(aerWarnings.some(w => /recycle-coupled/i.test(w))).toBe(false);
  });
});

// ── Phase 2.4 — delegate the recognised MLE-MBR train to the validated generator ──
describe('Phase 2.4 — MLE-MBR train delegates to exact WWTP Design.xlsm numbers', () => {
  function mleMbrCanvas(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [
      { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 70, COD: 900, sCOD: 261, BOD5: 396, TKN: 70, NH3N: 52, NO3N: 0, TP: 15, TSS: 405, VSS: 320, pH: 7.5, alkalinity: 4.4, DO: 0, temperature: 15 } } },
      { id: 'anx', type: 'processUnit', data: { unitType: 'bioreactor_anoxic', parameters: { volume: 13 } } },
      { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt: 20, mlss: 12000 } } },
      { id: 'mbr', type: 'processUnit', data: { unitType: 'mbr', parameters: {} } },
      { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
    ];
    const edges: GraphEdge[] = [
      { id: 'feed', source: 'inf', target: 'anx', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'anx_aer', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'aer_mbr', source: 'aer', target: 'mbr', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'mbr_eff', source: 'mbr', target: 'eff', sourceHandle: 'permeate', targetHandle: 'in' },
      { id: 'imlr', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 4 },
    ];
    return { nodes, edges };
  }

  it('recognises the train and returns the validated design mapped to the blocks', () => {
    const { nodes, edges } = mleMbrCanvas();
    const { train, design } = delegateMleDesign(nodes, edges);

    expect(train.matched).toBe(true);
    expect(train.config).toBe('MLE_MBR');
    expect(train.aerobicNodeId).toBe('aer');
    expect(train.anoxicNodeId).toBe('anx');
    expect(design).not.toBeNull();

    // eslint-disable-next-line no-console
    console.log('Delegated MLE-MBR design (exact xlsm/Marais-Ekama):', JSON.stringify({
      aerobicVolumeM3: design!.reactor.aerobicVolumeM3,
      anoxicVolumeM3: design!.reactor.anoxicVolumeM3,
      effluent: design!.effluent,
      membraneAreaM2: design!.mbr.membraneAreaM2,
    }, null, 2));

    // The validated generator returns real sized geometry to paint onto the blocks.
    expect(design!.reactor.aerobicVolumeM3).toBeGreaterThan(0);
    expect(design!.reactor.anoxicVolumeM3).toBeGreaterThan(0);
    expect(design!.effluent.ammoniaMgL).toBeGreaterThanOrEqual(0);
    expect(design!.mbr.membraneAreaM2).toBeGreaterThan(0);
    expect(design!.mbr.included).toBe(true);
  });

  it('does not delegate a non-MLE train', () => {
    const nodes: GraphNode[] = [
      { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 1000, COD: 500 } } },
      { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
    ];
    const edges: GraphEdge[] = [{ id: 'e', source: 'inf', target: 'eff', sourceHandle: 'out', targetHandle: 'in' }];
    const { train, design } = delegateMleDesign(nodes, edges);
    expect(train.matched).toBe(false);
    expect(design).toBeNull();
  });
});
