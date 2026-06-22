import { describe, it, expect } from 'vitest';
import { designMleMbr } from '../src/design/mle-mbr';
import type { MleMbrBasis } from '../src/design/mle-mbr';
import { evaluatePlant } from '../src/engine/evaluate';
import type { GraphDefinition } from '../src/engine/evaluate';

/**
 * UCT process acceptance suite — reconciled to docs/WWTP Design.xlsm.
 *
 * The workbook selects the UCT process when biological P removal is required
 * (sheet 2: =IF(P removal="Yes","UCT Process","MLE Process")). UCT carves an
 * anaerobic (EBPR) zone out of the aerobic volume via an extra unaerated mass
 * fraction (sheet 5):
 *   Vt  = Vt,min × 1.25
 *   Vax = Vt × fxt                 (anoxic; same as MLE)
 *   Va  = Vt × (1 − fxm)           where fxm = fxt + fan  (UCT)  vs  Vt × (1 − fxt) (MLE)
 *   Van = Vt − Va − Vax = Vt × fan (UCT)  vs  0 (MLE)
 * and runs three recycles: a (IMLR aerobic→anoxic), s (RAS), r (anoxic→anaerobic).
 */

const baseBasis = (overrides: MleMbrBasis['overrides'], phosphorusRemoval: boolean): MleMbrBasis => ({
  adwfM3d: 70,
  codMgL: 900,
  tminC: 15,
  tmaxC: 25,
  elevationM: 1700,
  nitrogenRemoval: true,
  phosphorusRemoval,
  dischargeStandard: 'Special',
  mbrRequired: true,
  membraneModel: 'megavision',
  landUse: 'residential',
  overrides,
});

const FXT = 0.25;
const FAN = 0.1;

describe('UCT design — anaerobic zone split matches WWTP Design.xlsm sheet 5', () => {
  const uct = designMleMbr(baseBasis({ anoxicMassFraction: FXT, anaerobicMassFraction: FAN, mlssMgL: 10000, sludgeAgeDays: 20 }, true));
  const Vt = uct.reactor.volumeSelectedM3;

  it('selects the UCT (A2O_UCT) config when P removal is required', () => {
    expect(uct.process.config).toBe('A2O_UCT');
    expect(uct.process.massFractions).toEqual({ anoxic: FXT, anaerobic: FAN, unaerated: FXT + FAN });
  });

  it('sizes the zones by the sheet-5 mass-fraction split', () => {
    expect(uct.reactor.anoxicVolumeM3).toBeCloseTo(Vt * FXT, 1);
    expect(uct.reactor.anaerobicVolumeM3).toBeCloseTo(Vt * FAN, 1);
    expect(uct.reactor.aerobicVolumeM3).toBeCloseTo(Vt * (1 - FXT - FAN), 1);
    // Zones partition the total reactor volume.
    expect(uct.reactor.aerobicVolumeM3 + uct.reactor.anoxicVolumeM3 + uct.reactor.anaerobicVolumeM3).toBeCloseTo(Vt, 0);
  });

  it('runs the three UCT recycles (a IMLR, s RAS, r anoxic→anaerobic)', () => {
    expect(uct.process.recycle).toHaveProperty('a');
    expect(uct.process.recycle).toHaveProperty('s');
    expect(uct.process.recycle.r).toBeGreaterThan(0); // r-recycle is the UCT defining return
  });

  it('only difference from MLE is the anaerobic zone carved out of the aerobic (same total + anoxic)', () => {
    const mle = designMleMbr(baseBasis({ anoxicMassFraction: FXT, anaerobicMassFraction: FAN, mlssMgL: 10000, sludgeAgeDays: 20 }, false));
    expect(mle.process.config).toBe('MLE');
    expect(mle.reactor.anaerobicVolumeM3).toBe(0);                                  // MLE has no anaerobic zone
    expect(mle.reactor.volumeSelectedM3).toBeCloseTo(Vt, 1);                         // sludge-mass-driven; config-independent
    expect(mle.reactor.anoxicVolumeM3).toBeCloseTo(uct.reactor.anoxicVolumeM3, 1);  // anoxic unchanged
    expect(mle.reactor.aerobicVolumeM3 - uct.reactor.aerobicVolumeM3).toBeCloseTo(uct.reactor.anaerobicVolumeM3, 1);
  });

  it('the anaerobic mass fraction drives the zone size', () => {
    const bigger = designMleMbr(baseBasis({ anoxicMassFraction: FXT, anaerobicMassFraction: 0.2, mlssMgL: 10000, sludgeAgeDays: 20 }, true));
    expect(bigger.reactor.anaerobicVolumeM3).toBeCloseTo(bigger.reactor.volumeSelectedM3 * 0.2, 1);
    expect(bigger.reactor.anaerobicVolumeM3).toBeGreaterThan(uct.reactor.anaerobicVolumeM3);
  });
});

// ---- flowsheet recognition + delegate ----
const node = (id: string, unitType: string, parameters: Record<string, number> = {}) =>
  ({ id, type: 'processUnit', data: { unitType, parameters } });
const edge = (id: string, source: string, target: string, sourceHandle: string, recycleRatio?: number) =>
  ({ id, source, target, sourceHandle, targetHandle: 'in', ...(recycleRatio !== undefined ? { recycleRatio } : {}) });

const uctCanvas = (anaerobicFraction?: number): GraphDefinition => ({
  nodes: [
    node('inf', 'influent', { flow: 70, COD: 900, TKN: 55, NH3N: 40, TP: 14, TSS: 400, temperature: 15 }),
    node('ana', 'bioreactor_anaerobic', anaerobicFraction !== undefined ? { anaerobic_fraction: anaerobicFraction } : {}),
    node('anx', 'bioreactor_anoxic', { anoxic_fraction: 0.25, srt: 20 }),
    node('aer', 'bioreactor_aerobic', { srt: 20, mlss: 10000 }),
    node('mbr', 'mbr', {}),
    node('eff', 'effluent', {}),
  ],
  edges: [
    edge('f1', 'inf', 'ana', 'out'),
    edge('f2', 'ana', 'anx', 'out'),
    edge('f3', 'anx', 'aer', 'out'),
    edge('f4', 'aer', 'mbr', 'out'),
    edge('p', 'mbr', 'eff', 'permeate'),
    edge('a', 'aer', 'anx', 'out', 4),  // a-recycle (IMLR)
    edge('r', 'anx', 'ana', 'out', 1),  // r-recycle (UCT: anoxic → anaerobic)
  ],
});

describe('UCT flowsheet recognition + delegate', () => {
  it('recognises the UCT-MBR train and attaches the anaerobic zone', () => {
    const r = evaluatePlant(uctCanvas());
    expect(r.recognisedTrain.matched).toBe(true);
    expect(r.recognisedTrain.config).toBe('UCT_MBR');
    expect(r.recognisedTrain.anaerobicNodeId).toBe('ana');
    expect(r.recognisedTrain.anoxicNodeId).toBe('anx');
    expect(r.delegatedDesign).not.toBeNull();
    expect(r.delegatedDesign!.process.config).toBe('A2O_UCT');
    expect(r.delegatedDesign!.reactor.anaerobicVolumeM3).toBeGreaterThan(0);
  });

  it('carries the drawn anaerobic mass fraction into the delegated zone size', () => {
    const a = evaluatePlant(uctCanvas(0.1));
    const b = evaluatePlant(uctCanvas(0.2));
    expect(a.delegatedDesign!.reactor.anaerobicVolumeM3).toBeGreaterThan(0);
    expect(b.delegatedDesign!.reactor.anaerobicVolumeM3).toBeGreaterThan(a.delegatedDesign!.reactor.anaerobicVolumeM3);
  });

  it('keeps recycle internal — UCT effluent ≈ influent feed (not inflated by a/r recycles)', () => {
    const r = evaluatePlant(uctCanvas());
    expect(r.effluentStream).not.toBeNull();
    expect(r.effluentStream!.flow).toBeLessThanOrEqual(70 + 1e-3);
    expect(r.effluentStream!.flow).toBeGreaterThan(60);
  });
});
