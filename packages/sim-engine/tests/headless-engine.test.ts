import { describe, it, expect } from 'vitest';
import { evaluatePlant } from '../src/engine/evaluate';
import type { GraphDefinition } from '../src/engine/evaluate';
import { delegateMleDesign } from '../src/graph/recognise-mle-train';

/**
 * Phase 3 acceptance: the whole simulation runs headless on a graph DEFINITION,
 * with no UI/canvas present. The graph below is a plain object exactly as it
 * would arrive from parsed JSON. evaluatePlant returns the consolidated
 * { sizedPlant, effluentStream, CAPEX, OPEX, footprint, ... } the optimizer needs.
 */

// A complete conventional-AS plant as it would be stored/serialised as JSON.
const PLANT_JSON = `{
  "nodes": [
    { "id": "inf", "type": "processUnit", "data": { "unitType": "influent", "parameters": { "flow": 10000, "COD": 500, "sCOD": 200, "BOD5": 250, "TKN": 40, "NH3N": 25, "NO3N": 0.5, "TP": 8, "TSS": 250, "VSS": 200, "pH": 7.2, "alkalinity": 5, "DO": 0, "temperature": 20 } } },
    { "id": "scr", "type": "processUnit", "data": { "unitType": "screen", "parameters": { "screen_type": 1, "bar_spacing_mm": 6, "approach_velocity_mps": 0.6, "peak_factor": 2.5, "channel_depth_m": 1.0 } } },
    { "id": "aer", "type": "processUnit", "data": { "unitType": "bioreactor_aerobic", "parameters": { "srt": 15, "mlss": 4000, "do_setpoint": 2 } } },
    { "id": "sc", "type": "processUnit", "data": { "unitType": "secondary_clarifier", "parameters": { "surface_area": 1200, "depth": 4, "tss_removal": 99.5, "uo_ratio": 0.75 } } },
    { "id": "eff", "type": "processUnit", "data": { "unitType": "effluent", "parameters": {} } }
  ],
  "edges": [
    { "id": "e1", "source": "inf", "target": "scr", "sourceHandle": "out", "targetHandle": "in" },
    { "id": "e2", "source": "scr", "target": "aer", "sourceHandle": "out", "targetHandle": "in" },
    { "id": "e3", "source": "aer", "target": "sc", "sourceHandle": "out", "targetHandle": "in" },
    { "id": "e4", "source": "sc", "target": "eff", "sourceHandle": "overflow", "targetHandle": "in" }
  ],
  "standards": { "COD": 75, "NH3N": 6, "TSS": 25 }
}`;

describe('Phase 3 — headless engine on a graph definition (no UI)', () => {
  it('evaluates a plant parsed from JSON and returns the consolidated result', () => {
    const graph = JSON.parse(PLANT_JSON) as GraphDefinition;
    const result = evaluatePlant(graph);

    // eslint-disable-next-line no-console
    console.log('Headless plant evaluation:', JSON.stringify({
      converged: result.converged,
      effluent: result.effluentStream && {
        flow: Math.round(result.effluentStream.flow),
        COD: Math.round(result.effluentStream.COD),
        NH3N: Math.round(result.effluentStream.NH3N * 10) / 10,
        TSS: Math.round(result.effluentStream.TSS),
      },
      compliancePass: result.compliancePass,
      CAPEX_Zar: Math.round(result.capexZar),
      OPEX_ZarPerYear: Math.round(result.opexZarPerYear),
      energyKwhPerDay: Math.round(result.energyKwhPerDay),
      footprintM2: Math.round(result.footprintM2),
      sizedBlocks: Object.keys(result.sizedPlant),
    }, null, 2));

    // The brief's required outputs are all present and sane.
    expect(result.converged).toBe(true);
    expect(result.effluentStream).not.toBeNull();
    expect(result.effluentStream!.flow).toBeGreaterThan(0);
    expect(result.capexZar).toBeGreaterThan(0);
    expect(result.opexZarPerYear).toBeGreaterThan(0);
    expect(result.energyKwhPerDay).toBeGreaterThan(0);
    expect(result.footprintM2).toBeGreaterThan(0);
    expect(Object.keys(result.sizedPlant).length).toBeGreaterThan(0);
    expect(result.ledger.plant.length).toBeGreaterThan(0);

    // Compliance was scored against the supplied standards.
    expect(result.compliance).not.toBeNull();
    expect(typeof result.compliancePass).toBe('boolean');
  });

  it('is deterministic: identical input gives identical CAPEX/OPEX/footprint', () => {
    const graph = JSON.parse(PLANT_JSON) as GraphDefinition;
    const a = evaluatePlant(graph);
    const b = evaluatePlant(graph);
    expect(a.capexZar).toBe(b.capexZar);
    expect(a.opexZarPerYear).toBe(b.opexZarPerYear);
    expect(a.footprintM2).toBe(b.footprintM2);
    expect(a.effluentStream!.COD).toBe(b.effluentStream!.COD);
  });

  it('OPEX scales with the electricity tariff', () => {
    const graph = JSON.parse(PLANT_JSON) as GraphDefinition;
    const cheap = evaluatePlant(graph, { energyTariffZarPerKwh: 1.0 });
    const dear = evaluatePlant(graph, { energyTariffZarPerKwh: 3.0 });
    expect(dear.opexZarPerYear).toBeCloseTo(cheap.opexZarPerYear * 3, 0);
  });

  it('recognises an MLE-MBR train and attaches the delegated design', () => {
    const graph: GraphDefinition = {
      nodes: [
        { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 70, COD: 900, temperature: 15 } } },
        { id: 'anx', type: 'processUnit', data: { unitType: 'bioreactor_anoxic', parameters: { volume: 13 } } },
        { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt: 20, mlss: 12000 } } },
        { id: 'mbr', type: 'processUnit', data: { unitType: 'mbr', parameters: {} } },
        { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
      ],
      edges: [
        { id: 'f', source: 'inf', target: 'anx', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'a', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'm', source: 'aer', target: 'mbr', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'p', source: 'mbr', target: 'eff', sourceHandle: 'permeate', targetHandle: 'in' },
        { id: 'r', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 4 },
      ],
    };
    const result = evaluatePlant(graph);
    expect(result.recognisedTrain.matched).toBe(true);
    expect(result.recognisedTrain.config).toBe('MLE_MBR');
    expect(result.delegatedDesign).not.toBeNull();
    expect(result.delegatedDesign!.reactor.aerobicVolumeM3).toBeGreaterThan(0);
  });

  it('delegated reactor sizing tracks the drawn SRT/MLSS/anoxic-fraction (so Apply changes volumes)', () => {
    const mk = (srt: number, mlss: number, fxt: number): GraphDefinition => ({
      nodes: [
        { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 5000, COD: 700, temperature: 15 } } },
        { id: 'anx', type: 'processUnit', data: { unitType: 'bioreactor_anoxic', parameters: { anoxic_fraction: fxt, srt } } },
        { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt, mlss } } },
        { id: 'sc', type: 'processUnit', data: { unitType: 'secondary_clarifier', parameters: {} } },
        { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
      ],
      edges: [
        { id: 'f', source: 'inf', target: 'anx', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'a', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
        { id: 's', source: 'aer', target: 'sc', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e', source: 'sc', target: 'eff', sourceHandle: 'overflow', targetHandle: 'in' },
        { id: 'imlr', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: 4 },
        { id: 'ras', source: 'sc', target: 'anx', sourceHandle: 'underflow', targetHandle: 'in', recycleRatio: 0.75 },
      ],
    });
    const a = evaluatePlant(mk(20, 4000, 0.25));
    const b = evaluatePlant(mk(12, 4800, 0.35));
    expect(a.recognisedTrain.matched).toBe(true);
    expect(b.recognisedTrain.matched).toBe(true);
    expect(Math.abs(a.delegatedDesign!.reactor.aerobicVolumeM3 - b.delegatedDesign!.reactor.aerobicVolumeM3)).toBeGreaterThan(1);
    expect(Math.abs(a.delegatedDesign!.reactor.anoxicVolumeM3 - b.delegatedDesign!.reactor.anoxicVolumeM3)).toBeGreaterThan(1);
  });

  it('an MBR train tracks the drawn drivers too, and the re-run reproduces the detail-panel design exactly (Apply is not "linked")', () => {
    // Mirrors the optimiser → Apply path on an MLE+MBR canvas (the screenshot case):
    // anoxic -> aerobic -> mbr -> effluent with an IMLR recycle. Applying different
    // optimiser drivers must yield DIFFERENT reactor + membrane sizing, and the value
    // the store patches in (evaluatePlant's delegatedDesign) must equal the optimiser
    // detail panel (delegateMleDesign on the same graph) — no divergence.
    const mk = (srt: number, mlss: number, fxt: number, aRec: number): GraphDefinition => ({
      nodes: [
        { id: 'inf', type: 'processUnit', data: { unitType: 'influent', parameters: { flow: 40, COD: 800, temperature: 15 } } },
        { id: 'anx', type: 'processUnit', data: { unitType: 'bioreactor_anoxic', parameters: { anoxic_fraction: fxt, srt } } },
        { id: 'aer', type: 'processUnit', data: { unitType: 'bioreactor_aerobic', parameters: { srt, mlss } } },
        { id: 'mbr', type: 'processUnit', data: { unitType: 'mbr', parameters: {} } },
        { id: 'eff', type: 'processUnit', data: { unitType: 'effluent', parameters: {} } },
      ],
      edges: [
        { id: 'f', source: 'inf', target: 'anx', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'a', source: 'anx', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'm', source: 'aer', target: 'mbr', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'p', source: 'mbr', target: 'eff', sourceHandle: 'permeate', targetHandle: 'in' },
        { id: 'imlr', source: 'aer', target: 'anx', sourceHandle: 'out', targetHandle: 'in', recycleRatio: aRec },
      ],
    });

    const a = evaluatePlant(mk(10, 12000, 0.3, 6));
    const b = evaluatePlant(mk(25, 8000, 0.15, 2));
    expect(a.recognisedTrain.config).toBe('MLE_MBR');
    expect(b.recognisedTrain.config).toBe('MLE_MBR');

    // Distinct drivers → distinct REACTOR sizing (the "are they linked?" check).
    expect(Math.abs(a.delegatedDesign!.reactor.aerobicVolumeM3 - b.delegatedDesign!.reactor.aerobicVolumeM3)).toBeGreaterThan(1);
    expect(Math.abs(a.delegatedDesign!.reactor.volumeSelectedM3 - b.delegatedDesign!.reactor.volumeSelectedM3)).toBeGreaterThan(1);
    expect(a.delegatedDesign!.process.mlssMgL).not.toBe(b.delegatedDesign!.process.mlssMgL);
    // Membrane area is flux × flow driven, NOT SRT/MLSS driven — at the same influent
    // flow it is (correctly) identical across picks. Documents why membrane area alone
    // does not visibly change between Pareto points at one flow.
    expect(a.delegatedDesign!.mbr.membraneAreaM2).toBe(b.delegatedDesign!.mbr.membraneAreaM2);

    // The store patches reactor sizing from delegatedDesign; the optimiser detail panel
    // shows delegateMleDesign on the same graph. They must be identical (no divergence
    // between what you previewed and what Apply lands).
    const panel = delegateMleDesign(mk(10, 12000, 0.3, 6).nodes, mk(10, 12000, 0.3, 6).edges).design!;
    expect(panel.reactor.aerobicVolumeM3).toBe(a.delegatedDesign!.reactor.aerobicVolumeM3);
    expect(panel.mbr.membraneAreaM2).toBe(a.delegatedDesign!.mbr.membraneAreaM2);
  });
});
