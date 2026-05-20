import { describe, it, expect } from 'vitest';
import {
  Influent,
  influentDefinition,
  PrimaryClarifier,
  BioreactorAerobic,
  bioreactorAerobicDefinition,
  BioreactorAnoxic,
  bioreactorAnoxicDefinition,
  BioreactorAnaerobic,
  SecondaryClarifier,
  Splitter,
  Mixer,
  Thickener,
  Effluent,
  checkCompliance,
  createUnit,
  unitDefinitions,
  Screen,
  GritRemoval,
  EqualisationTank,
  equalisationTankDefinition,
  MBR,
  mbrDefinition,
  AerationBlower,
  aerationBlowerDefinition,
  Dewatering,
  ChemicalDosing,
  UvDisinfection,
  InletPumping,
} from '../src/units/index';
import { emptyWaterQuality, mixStreams } from '../src/types';
import type { WaterQuality, UnitType } from '../src/types';
import { assertValidV2Outputs } from './helpers/v2-outputs';
import { assertHasCalculationRecord, assertAllRecordsValid } from './helpers/calculation-records';

// ── Helper: typical raw wastewater ──────────────────────────
function typicalInfluent(): WaterQuality {
  return {
    flow: 10000, COD: 500, sCOD: 200, BOD5: 250,
    TKN: 40, NH3N: 25, NO3N: 0.5, TP: 8,
    TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5,
    DO: 0, temperature: 20,
  };
}

// ── Influent ────────────────────────────────────────────────
describe('Influent', () => {
  it('creates output from parameters', () => {
    const unit = new Influent({ flow: 5000, COD: 300, sCOD: 120, BOD5: 150, TKN: 30, NH3N: 20, NO3N: 0.5, TP: 6, TSS: 200, VSS: 160, pH: 7, alkalinity: 4, DO: 0, temperature: 18 });
    const result = unit.process([]);
    expect(result.outputs.out.flow).toBe(5000);
    expect(result.outputs.out.COD).toBe(300);
    expect(result.outputs.out.temperature).toBe(18);
  });

  it('uses defaults when parameters are missing', () => {
    const unit = new Influent({});
    const result = unit.process([]);
    expect(result.outputs.out.flow).toBe(10000);
    expect(result.outputs.out.COD).toBe(500);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Influent({ flow: 1000, COD: 500, TSS: 250 });
    const result = unit.process([]);
    assertValidV2Outputs(result);
  });

  it('emits design-basis calculation records with citations', () => {
    const unit = new Influent({ flow: 1000, COD: 500, TKN: 45, TSS: 250 });
    const result = unit.process([]);
    const flowRecord = assertHasCalculationRecord(result.calculationRecords, 'design flow');
    expect(flowRecord.result.value).toBe(1000);
    expect(flowRecord.result.unit).toBe('m3/d');
    expect(flowRecord.citation).toContain('User input');
    assertAllRecordsValid(result.calculationRecords);
  });

  it('marks only flow / COD / TKN as essential, rest advanced', () => {
    const essential = influentDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual(['flow', 'COD', 'TKN']);
  });
});

// ── Primary Clarifier ───────────────────────────────────────
describe('PrimaryClarifier', () => {
  it('removes TSS and BOD in overflow', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const result = unit.process([typicalInfluent()]);
    const ov = result.outputs.overflow;

    // TSS should be 40% of influent (60% removed)
    expect(ov.TSS).toBeCloseTo(250 * 0.4, 0);
    // BOD should be 70% of influent (30% removed)
    expect(ov.BOD5).toBeCloseTo(250 * 0.7, 0);
    // Soluble components pass through
    expect(ov.sCOD).toBe(200);
    expect(ov.NH3N).toBe(25);
  });

  it('conserves mass between overflow and underflow', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const inf = typicalInfluent();
    const result = unit.process([inf]);
    const ov = result.outputs.overflow;
    const uf = result.outputs.underflow;

    // Mass balance: influentMass = overflowMass + underflowMass
    const massIn = inf.COD * inf.flow;
    const massOv = ov.COD * ov.flow;
    const massUf = uf.COD * uf.flow;
    expect(massOv + massUf).toBeCloseTo(massIn, -1);
  });

  it('has reasonable flow split', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const result = unit.process([typicalInfluent()]);
    const totalFlow = result.outputs.overflow.flow + result.outputs.underflow.flow;
    expect(totalFlow).toBeCloseTo(10000, 0);
    // Underflow should be small fraction
    expect(result.outputs.underflow.flow).toBeLessThan(1000);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const input = { ...emptyWaterQuality(), flow: 1000, TSS: 300 };
    const result = unit.process([input]);
    assertValidV2Outputs(result);
  });
});

describe('PrimaryClarifier — Phase 1b', () => {
  it('emits sizing, BoQ, and calculation records with citations', () => {
    const unit = new PrimaryClarifier({
      tss_removal: 60, bod_removal: 30, cod_removal: 30,
      tkn_removal: 15, tp_removal: 10, uo_ratio: 0.05,
      surface_area: 500, depth: 3.5,
    });
    const inf = { ...emptyWaterQuality(), flow: 15000, TSS: 300, COD: 800 };
    const result = unit.process([inf]);

    expect(result.sizing?.surfaceArea.value).toBe(500);
    expect(result.sizing?.surfaceArea.unit).toBe('m2');
    expect(result.sizing?.volume.value).toBeCloseTo(500 * 3.5, 1);
    expect(result.sizing?.volume.unit).toBe('m3');

    expect(result.capex?.lineItems.length).toBeGreaterThanOrEqual(2);
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    expect(civil).toBeDefined();
    expect(civil!.sourceCitation).toContain('CH-ISE internal estimate');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);

    assertHasCalculationRecord(result.calculationRecords, 'SOR');
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertAllRecordsValid(result.calculationRecords);
  });

  it('warns when SOR exceeds 40 m3/m2/d at ADWF', () => {
    const unit = new PrimaryClarifier({
      tss_removal: 60, bod_removal: 30, cod_removal: 30,
      tkn_removal: 15, tp_removal: 10, uo_ratio: 0.05,
      surface_area: 100, depth: 3.5,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 300 };
    const result = unit.process([inf]);
    expect(result.warnings?.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toMatch(/SOR/i);
  });
});

// ── Aerobic Bioreactor ──────────────────────────────────────
describe('BioreactorAerobic', () => {
  it('removes sCOD and performs nitrification', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45,
      nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const result = unit.process([typicalInfluent()]);
    const out = result.outputs.out;

    // sCOD reduced by 90%
    expect(out.sCOD).toBeCloseTo(200 * 0.1, 0);
    // NH3 oxidised ~95%
    expect(out.NH3N).toBeCloseTo(25 * 0.05, 0);
    // NO3 should increase
    expect(out.NO3N).toBeGreaterThan(20);
    // BOD reduced by 95%
    expect(out.BOD5).toBeCloseTo(250 * 0.05, 0);
  });

  it('produces MLSS metadata', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45,
      nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const result = unit.process([typicalInfluent()]);
    expect(result.metadata.MLSS).toBeGreaterThan(1000);
    expect(result.metadata.MLSS).toBeLessThan(10000);
    expect(result.metadata.HRT_hours).toBeGreaterThan(0);
    expect(result.metadata.O2_demand_total).toBeGreaterThan(0);
  });

  it('consumes alkalinity during nitrification', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45,
      nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const result = unit.process([typicalInfluent()]);
    expect(result.outputs.out.alkalinity).toBeLessThan(5); // influent was 5 mmol/L
  });

  it('skips nitrification at low SRT', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, do_setpoint: 2, srt: 2, yield_obs: 0.45,
      nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const result = unit.process([typicalInfluent()]);
    // NH3 should NOT be removed at SRT=2 days
    expect(result.outputs.out.NH3N).toBeCloseTo(25, 0);
    expect(result.outputs.out.NO3N).toBeCloseTo(0.5, 0);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45,
      nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const result = unit.process([typicalInfluent()]);
    assertValidV2Outputs(result);
  });

  it('marks only volume + SRT as essential, rest advanced', () => {
    const essential = bioreactorAerobicDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual(['volume', 'srt']);
  });
});

describe('BioreactorAerobic — Phase 1b', () => {
  it('emits sizing, O2 demand records, civil + diffuser BoQ', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, depth: 4.5, do_setpoint: 2.0,
      srt: 12, yield_obs: 0.45, nitrification_eff: 95,
      cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, sCOD: 300, COD: 500, NH3N: 30, TKN: 40 };
    const result = unit.process([inf]);

    expect(result.sizing?.volume.value).toBe(5000);
    expect(result.sizing?.HRT.value).toBeCloseTo((5000 / 10000) * 24, 1);
    expect(result.sizing?.MLSS).toBeDefined();

    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertHasCalculationRecord(result.calculationRecords, 'O2');
    assertHasCalculationRecord(result.calculationRecords, 'MLSS');

    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const diffusers = result.capex!.lineItems.find(i => i.description.toLowerCase().includes('diffuser'));
    expect(civil).toBeDefined();
    expect(diffusers).toBeDefined();
    expect(diffusers!.quantity).toBeGreaterThan(0);
    expect(result.capex!.total).toBeGreaterThan(0);

    expect(result.energy?.installedKW).toBe(0);

    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Anoxic Bioreactor ───────────────────────────────────────
describe('BioreactorAnoxic', () => {
  it('denitrifies NO3', () => {
    const unit = new BioreactorAnoxic({
      volume: 2500, denitrification_rate: 0.1, cod_per_no3: 6, endogenous_rate: 0.05,
    });
    // Feed with nitrified water
    const nitrifiedFeed: WaterQuality = {
      ...typicalInfluent(),
      NH3N: 2, NO3N: 22, sCOD: 150,
    };
    const result = unit.process([nitrifiedFeed]);
    expect(result.outputs.out.NO3N).toBeLessThan(22);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new BioreactorAnoxic({ volume: 2000, denitrification_eff: 85, cod_n_ratio: 6 });
    const result = unit.process([typicalInfluent()]);
    assertValidV2Outputs(result);
  });

  it('marks only volume as essential, rest advanced', () => {
    const essential = bioreactorAnoxicDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual(['volume']);
  });
});

describe('BioreactorAnoxic — Phase 1b', () => {
  it('emits sizing, energy, mixer BoQ, and denitrification capacity record', () => {
    const unit = new BioreactorAnoxic({
      volume: 2000, depth: 4.5, denitrification_eff: 85, cod_n_ratio: 6,
    });
    const inf = { ...emptyWaterQuality(), flow: 5000, sCOD: 300, NO3N: 15, TSS: 3500 };
    const result = unit.process([inf]);
    expect(result.sizing?.volume.value).toBe(2000);
    expect(result.energy?.installedKW).toBeGreaterThan(0);
    expect(result.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(result.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertHasCalculationRecord(result.calculationRecords, 'denit');
    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Anaerobic Bioreactor ────────────────────────────────────
describe('BioreactorAnaerobic', () => {
  it('releases phosphorus', () => {
    const unit = new BioreactorAnaerobic({
      volume: 1500, p_release_rate: 0.15, vfa_uptake_rate: 0.2,
    });
    const result = unit.process([typicalInfluent()]);
    // TP should increase (P release in anaerobic zone)
    expect(result.outputs.out.TP).toBeGreaterThanOrEqual(typicalInfluent().TP);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new BioreactorAnaerobic({ volume: 1500, p_release_rate: 0.3, vfa_fraction: 0.2 });
    const result = unit.process([typicalInfluent()]);
    assertValidV2Outputs(result);
  });
});

describe('BioreactorAnaerobic — Phase 1b', () => {
  it('emits sizing, energy, mixer BoQ, and records', () => {
    const unit = new BioreactorAnaerobic({
      volume: 1500, depth: 4.5, p_release_rate: 0.3, vfa_fraction: 0.2,
    });
    const inf = { ...emptyWaterQuality(), flow: 5000, sCOD: 200, TP: 10 };
    const result = unit.process([inf]);
    expect(result.sizing?.volume.value).toBe(1500);
    expect(result.sizing?.HRT.value).toBeCloseTo((1500 / 5000) * 24, 1);
    expect(result.energy?.installedKW).toBeGreaterThan(0);
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(mech!.description.toLowerCase()).toContain('mixer');
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Secondary Clarifier ─────────────────────────────────────
describe('SecondaryClarifier', () => {
  it('produces low TSS overflow', () => {
    const unit = new SecondaryClarifier({
      surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const bioReactorEff: WaterQuality = {
      ...typicalInfluent(),
      TSS: 3000, VSS: 2400, // MLSS from bioreactor
    };
    const result = unit.process([bioReactorEff]);
    expect(result.outputs.overflow.TSS).toBeLessThan(20);
  });

  it('concentrates solids in underflow', () => {
    const unit = new SecondaryClarifier({
      surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const bioReactorEff: WaterQuality = {
      ...typicalInfluent(),
      TSS: 3000, VSS: 2400,
    };
    const result = unit.process([bioReactorEff]);
    expect(result.outputs.underflow.TSS).toBeGreaterThan(3000);
  });

  it('conserves flow', () => {
    const unit = new SecondaryClarifier({
      surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const result = unit.process([typicalInfluent()]);
    const totalFlow = result.outputs.overflow.flow + result.outputs.underflow.flow;
    expect(totalFlow).toBeCloseTo(10000, 0);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new SecondaryClarifier({ surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75 });
    const input = { ...emptyWaterQuality(), flow: 1000, TSS: 3000, VSS: 2400 };
    const result = unit.process([input]);
    assertValidV2Outputs(result);
  });
});

describe('SecondaryClarifier — Phase 1b', () => {
  it('emits sizing with SOR and SLR checks, BoQ, and records', () => {
    const unit = new SecondaryClarifier({
      surface_area: 800, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 3500 };
    const result = unit.process([inf]);

    expect(result.sizing?.surfaceArea.value).toBe(800);
    expect(result.sizing?.volume.value).toBeCloseTo(3200, 1);

    assertHasCalculationRecord(result.calculationRecords, 'SOR');
    assertHasCalculationRecord(result.calculationRecords, 'SLR');

    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);
    assertAllRecordsValid(result.calculationRecords);
  });

  it('warns when SLR exceeds 6 kg/m2/h at peak', () => {
    const unit = new SecondaryClarifier({
      surface_area: 100, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 5000 };
    const result = unit.process([inf]);
    expect(result.warnings?.some(w => /SLR/i.test(w))).toBe(true);
  });
});

// ── Splitter ────────────────────────────────────────────────
describe('Splitter', () => {
  it('splits flow according to ratio', () => {
    const unit = new Splitter({ split_ratio: 0.8 });
    const result = unit.process([typicalInfluent()]);
    expect(result.outputs.main.flow).toBeCloseTo(8000, 0);
    expect(result.outputs.side.flow).toBeCloseTo(2000, 0);
  });

  it('preserves concentrations in both outputs', () => {
    const unit = new Splitter({ split_ratio: 0.7 });
    const result = unit.process([typicalInfluent()]);
    expect(result.outputs.main.COD).toBe(500);
    expect(result.outputs.side.COD).toBe(500);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Splitter({ split_ratio: 0.5 });
    const input = { ...emptyWaterQuality(), flow: 1000 };
    const result = unit.process([input]);
    assertValidV2Outputs(result);
  });

  it('emits split-ratio calculation records', () => {
    const unit = new Splitter({ split_ratio: 0.3 });
    const inf = { ...emptyWaterQuality(), flow: 1000 };
    const result = unit.process([inf]);
    const rec = assertHasCalculationRecord(result.calculationRecords, 'split flow to main');
    expect(rec.result.value).toBeCloseTo(300, 1);
    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Mixer ───────────────────────────────────────────────────
describe('Mixer', () => {
  it('flow-weight averages two streams', () => {
    const unit = new Mixer({});
    const stream1: WaterQuality = { ...typicalInfluent(), flow: 8000, COD: 100 };
    const stream2: WaterQuality = { ...typicalInfluent(), flow: 2000, COD: 500 };
    const result = unit.process([stream1, stream2]);
    // Flow-weighted: (8000*100 + 2000*500) / 10000 = 180
    expect(result.outputs.out.COD).toBeCloseTo(180, 0);
    expect(result.outputs.out.flow).toBe(10000);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Mixer({});
    const a = { ...emptyWaterQuality(), flow: 500, COD: 400 };
    const b = { ...emptyWaterQuality(), flow: 500, COD: 200 };
    const result = unit.process([a, b]);
    assertValidV2Outputs(result);
  });

  it('emits flow-weighted mix calculation records', () => {
    const unit = new Mixer({});
    const a = { ...emptyWaterQuality(), flow: 600, COD: 400 };
    const b = { ...emptyWaterQuality(), flow: 400, COD: 200 };
    const result = unit.process([a, b]);
    const rec = assertHasCalculationRecord(result.calculationRecords, 'combined flow');
    expect(rec.result.value).toBeCloseTo(1000, 1);
    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Thickener ───────────────────────────────────────────────
describe('Thickener', () => {
  it('concentrates solids', () => {
    const unit = new Thickener({ target_solids_pct: 4, capture_efficiency: 0.95 });
    const sludge: WaterQuality = { ...typicalInfluent(), TSS: 5000, flow: 500 };
    const result = unit.process([sludge]);
    // Thickened output should have higher TSS
    expect(result.outputs.thickened.TSS).toBeGreaterThan(5000);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Thickener({});
    const input = { ...emptyWaterQuality(), flow: 100, TSS: 10000 };
    const result = unit.process([input]);
    assertValidV2Outputs(result);
  });
});

describe('Thickener — Phase 1b', () => {
  it('emits sizing with SLR check, civil + drive BoQ, and records', () => {
    const unit = new Thickener({
      target_solids_pct: 5, capture_efficiency: 95,
      surface_area: 30, depth: 3.0,
    });
    const inf = { ...emptyWaterQuality(), flow: 100, TSS: 10000 };
    const result = unit.process([inf]);
    expect(result.sizing?.surfaceArea.value).toBe(30);
    expect(result.sizing?.volume.value).toBeCloseTo(90, 1);
    assertHasCalculationRecord(result.calculationRecords, 'SLR');
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);
    assertAllRecordsValid(result.calculationRecords);
  });
});

// ── Effluent + Compliance ───────────────────────────────────
describe('Effluent', () => {
  it('passes through input', () => {
    const unit = new Effluent({});
    const result = unit.process([typicalInfluent()]);
    expect(result.outputs.out.flow).toBe(10000);
    expect(result.outputs.out.COD).toBe(500);
  });

  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Effluent({});
    const input = { ...emptyWaterQuality(), flow: 500, COD: 50 };
    const result = unit.process([input]);
    assertValidV2Outputs(result);
  });

  it('emits effluent-summary calculation records with citations', () => {
    const unit = new Effluent({});
    const inf = { ...emptyWaterQuality(), flow: 1000, COD: 60, NH3N: 1.5, NO3N: 8, TSS: 15, TP: 2 };
    const result = unit.process([inf]);
    assertHasCalculationRecord(result.calculationRecords, 'effluent flow');
    assertHasCalculationRecord(result.calculationRecords, 'effluent COD');
    assertHasCalculationRecord(result.calculationRecords, 'effluent NH3-N');
    assertAllRecordsValid(result.calculationRecords);
  });
});

describe('checkCompliance', () => {
  it('detects pass when effluent is clean', () => {
    const cleanEffluent: WaterQuality = {
      ...emptyWaterQuality(),
      flow: 10000, COD: 50, BOD5: 5, NH3N: 1, TSS: 10, TP: 0.5, pH: 7,
    };
    const result = checkCompliance(cleanEffluent, {
      COD: 75, BOD5: 10, NH3N: 6, TSS: 25, TP: 1, pH_min: 5.5, pH_max: 9.5,
    });
    expect(result.COD.pass).toBe(true);
    expect(result.BOD5.pass).toBe(true);
    expect(result.NH3N.pass).toBe(true);
    expect(result.TSS.pass).toBe(true);
    expect(result.TP.pass).toBe(true);
    expect(result.pH.pass).toBe(true);
  });

  it('detects fail when effluent exceeds limits', () => {
    const dirtyEffluent: WaterQuality = {
      ...emptyWaterQuality(),
      flow: 10000, COD: 200, BOD5: 50, NH3N: 15, TSS: 100, TP: 5, pH: 4,
    };
    const result = checkCompliance(dirtyEffluent, {
      COD: 75, BOD5: 10, NH3N: 6, TSS: 25, TP: 1, pH_min: 5.5, pH_max: 9.5,
    });
    expect(result.COD.pass).toBe(false);
    expect(result.BOD5.pass).toBe(false);
    expect(result.NH3N.pass).toBe(false);
    expect(result.TSS.pass).toBe(false);
    expect(result.TP.pass).toBe(false);
    expect(result.pH.pass).toBe(false);
  });
});

// ── createUnit factory ──────────────────────────────────────
describe('createUnit', () => {
  it('creates each unit type', () => {
    const types = [
      'influent', 'primary_clarifier', 'bioreactor_aerobic', 'bioreactor_anoxic',
      'bioreactor_anaerobic', 'secondary_clarifier', 'splitter', 'mixer', 'thickener', 'effluent',
    ] as const;
    for (const t of types) {
      const unit = createUnit(t, {});
      expect(unit.type).toBe(t);
    }
  });
});

// ── Zero-flow edge cases ───────────────────────────────────
describe('Zero-flow edge cases', () => {
  const zeroFlow: WaterQuality = { ...typicalInfluent(), flow: 0 };

  it('PrimaryClarifier handles zero flow without NaN', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.overflow.flow).toBe(0);
    expect(Number.isFinite(result.outputs.overflow.COD)).toBe(true);
    expect(Number.isFinite(result.outputs.underflow.COD)).toBe(true);
  });

  it('SecondaryClarifier handles zero flow without NaN', () => {
    const unit = new SecondaryClarifier({ surface_area: 800, tss_removal: 99.5, uo_ratio: 0.75 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.overflow.flow).toBe(0);
    expect(Number.isFinite(result.outputs.underflow.TSS)).toBe(true);
  });

  it('BioreactorAerobic handles zero flow without NaN', () => {
    const unit = new BioreactorAerobic({ volume: 5000, do_setpoint: 2, srt: 12, yield_obs: 0.45, nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.out.flow).toBe(0);
    expect(Number.isFinite(result.outputs.out.COD)).toBe(true);
  });

  it('BioreactorAnoxic handles zero flow without NaN', () => {
    const unit = new BioreactorAnoxic({ volume: 2000, denitrification_eff: 85, cod_n_ratio: 6 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.out.flow).toBe(0);
    expect(Number.isFinite(result.outputs.out.NO3N)).toBe(true);
  });

  it('BioreactorAnaerobic handles zero flow without NaN', () => {
    const unit = new BioreactorAnaerobic({ volume: 1500, p_release_rate: 0.3, vfa_fraction: 0.2 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.out.flow).toBe(0);
    expect(Number.isFinite(result.outputs.out.TP)).toBe(true);
  });

  it('Thickener handles zero flow without NaN', () => {
    const unit = new Thickener({ target_solids_pct: 5, capture_efficiency: 95 });
    const result = unit.process([zeroFlow]);
    expect(result.outputs.thickened.flow).toBe(0);
    expect(Number.isFinite(result.outputs.overflow.TSS)).toBe(true);
  });

  it('Splitter clamps ratio to valid range', () => {
    const unitLow = new Splitter({ split_ratio: 0 });
    const resultLow = unitLow.process([typicalInfluent()]);
    expect(resultLow.outputs.main.flow).toBeGreaterThan(0);
    expect(resultLow.outputs.side.flow).toBeGreaterThan(0);

    const unitHigh = new Splitter({ split_ratio: 1 });
    const resultHigh = unitHigh.process([typicalInfluent()]);
    expect(resultHigh.outputs.main.flow).toBeLessThan(10000);
    expect(resultHigh.outputs.side.flow).toBeGreaterThan(0);
  });

  it('handles empty input list', () => {
    const unit = new PrimaryClarifier({ tss_removal: 60, bod_removal: 30, cod_removal: 30, tkn_removal: 15, tp_removal: 10, surface_area: 500, depth: 3.5, uo_ratio: 0.05 });
    const result = unit.process([]);
    expect(result.outputs.overflow.flow).toBe(0);
    expect(Number.isFinite(result.outputs.overflow.COD)).toBe(true);
  });
});

// ── mixStreams ───────────────────────────────────────────────
describe('mixStreams', () => {
  it('returns empty for no streams', () => {
    const result = mixStreams([]);
    expect(result.flow).toBe(0);
  });

  it('returns identity for single stream', () => {
    const inf = typicalInfluent();
    const result = mixStreams([inf]);
    expect(result.COD).toBe(500);
    expect(result.flow).toBe(10000);
  });

  it('flow-weights correctly', () => {
    const a: WaterQuality = { ...emptyWaterQuality(), flow: 6000, COD: 100, pH: 7 };
    const b: WaterQuality = { ...emptyWaterQuality(), flow: 4000, COD: 200, pH: 7 };
    const result = mixStreams([a, b]);
    expect(result.flow).toBe(10000);
    expect(result.COD).toBeCloseTo(140, 0);
  });
});

describe('Screen', () => {
  describe('Coarse variant', () => {
    it('constructs with default parameters', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      expect(unit.type).toBe('screen');
    });

    it('passes flow through with minimal WQ change', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const inf = { ...emptyWaterQuality(), flow: 1000, TSS: 300, COD: 500 };
      const r = unit.process([inf]);
      expect(r.outputs.out.flow).toBeCloseTo(1000, 1);
      expect(r.outputs.out.COD).toBeCloseTo(500, 1);
      expect(r.outputs.out.TSS).toBeLessThan(300);
      expect(r.outputs.out.TSS).toBeGreaterThan(290);
    });

    it('emits sizing, BoQ, and calculation records', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
      expect(r.sizing?.channelArea).toBeDefined();
      expect(r.sizing?.headLoss).toBeDefined();
      assertHasCalculationRecord(r.calculationRecords, 'channel area');
      assertHasCalculationRecord(r.calculationRecords, 'head loss');
      expect(r.capex!.lineItems.length).toBeGreaterThan(0);
      expect(r.capex!.total).toBeGreaterThan(0);
      expect(r.consumables?.length).toBeGreaterThan(0);
      assertAllRecordsValid(r.calculationRecords);
    });
  });

  describe('Fine variant', () => {
    it('uses a different supplier price line than coarse', () => {
      const coarse = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const fine = new Screen({ bar_spacing_mm: 3, approach_velocity_mps: 0.6, screen_type: 1 });
      const inf = { ...emptyWaterQuality(), flow: 1000 };
      const rCoarse = coarse.process([inf]);
      const rFine = fine.process([inf]);
      expect(rFine.capex!.total).toBeGreaterThan(rCoarse.capex!.total);
    });
  });

  it('handles zero flow gracefully', () => {
    const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.out.flow).toBe(0);
  });
});

describe('GritRemoval', () => {
  it('sizes at 3–5 min HRT on peak flow', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 10000, TSS: 300 }]);
    expect(r.sizing?.volume.value).toBeCloseTo((10000 * 2.5 * 4) / 1440, 1);
  });

  it('emits civil + grit equipment BoQ', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 10000 }]);
    expect(r.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(r.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    expect(r.consumables?.find(c => /grit/i.test(c.item))).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'HRT');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('handles zero flow gracefully', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.out.flow).toBe(0);
  });
});

describe('EqualisationTank', () => {
  it('sizes volume from user HRT', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.sizing?.volume.value).toBeCloseTo(250, 1);
  });

  it('passes water quality through unchanged', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const inf = { ...emptyWaterQuality(), flow: 1000, COD: 600, TSS: 250 };
    const r = unit.process([inf]);
    expect(r.outputs.out.COD).toBe(600);
    expect(r.outputs.out.TSS).toBe(250);
  });

  it('emits civil + mixer BoQ and mixing energy', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    expect(r.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(r.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'HRT');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('marks only HRT as essential', () => {
    const essential = equalisationTankDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual(['hrt_hours']);
  });
});

describe('MBR', () => {
  it('sizes membrane area from flow and flux', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    expect(r.sizing?.membraneArea).toBeDefined();
    const expectedArea = (1000 * 1000) / (18.4 * 0.8 * 24);
    // installedArea = moduleCount × 64; should be close to ceiling of expectedArea / 64
    const expectedInstalled = Math.max(1, Math.ceil(expectedArea / 64)) * 64;
    expect(r.sizing!.membraneArea.value).toBeCloseTo(expectedInstalled, 0);
  });

  it('produces near-particle-free permeate', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    expect(r.outputs.permeate.TSS).toBeLessThan(5);
  });

  it('emits modules + CIP BoQ and air scour energy', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    const modulesItem = r.capex!.lineItems.find(i => i.description.toLowerCase().includes('smu'));
    const cipItem = r.capex!.lineItems.find(i => i.description.toLowerCase().includes('cip'));
    expect(modulesItem).toBeDefined();
    expect(cipItem).toBeDefined();
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    assertHasCalculationRecord(r.calculationRecords, 'membrane area');
    assertHasCalculationRecord(r.calculationRecords, 'air scour');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('handles zero flow gracefully', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.permeate.flow).toBe(0);
  });

  it('marks only flux as essential, rest advanced', () => {
    const essential = mbrDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual(['flux_lmh']);
  });
});

describe('AerationBlower', () => {
  it('computes air flow from O2 demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    expect(r.sizing?.airFlow.value).toBeGreaterThan(500);
    expect(r.sizing?.airFlow.value).toBeLessThan(20000);
  });

  it('picks PD blower for small demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 80, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    const mech = r.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech!.description.toLowerCase()).toContain('pd');
  });

  it('picks HST turbo for large demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 5000, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    const mech = r.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech!.description.toLowerCase()).toContain('hst');
  });

  it('emits energy records and BoQ with citation', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    expect(r.energy?.dailyKWh).toBeGreaterThan(0);
    assertHasCalculationRecord(r.calculationRecords, 'air flow');
    assertHasCalculationRecord(r.calculationRecords, 'blower power');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('has no essential parameters — all configuration is advanced', () => {
    const essential = aerationBlowerDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
    expect(essential).toEqual([]);
  });
});

describe('Dewatering', () => {
  it('produces cake at target solids concentration', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    expect(r.outputs.cake.TSS).toBeGreaterThan(150000);
  });

  it('returns filtrate with most water and some dissolved nutrients', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    expect(r.outputs.filtrate.flow).toBeGreaterThan(30);
    expect(r.outputs.filtrate.TSS).toBeLessThan(5000);
  });

  it('emits polymer consumable and cake disposal', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    expect(r.consumables?.find(c => /polymer/i.test(c.item))).toBeDefined();
    expect(r.consumables?.find(c => /cake|disposal/i.test(c.item))).toBeDefined();
  });

  it('picks centrifuge BoQ line when type=1', () => {
    const unit = new Dewatering({ dewatering_type: 1, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    const mech = r.capex!.lineItems.find(i => /centrifuge/i.test(i.description));
    expect(mech).toBeDefined();
  });
});

describe('ChemicalDosing', () => {
  it('computes daily chemical consumption from dose and flow', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 30, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    const chem = r.consumables?.find(c => /alum/i.test(c.item));
    expect(chem).toBeDefined();
    expect(chem!.daily).toBeCloseTo(30, 1);
  });

  it('applies P removal when chemical is coagulant (alum/ferric)', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 50, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TP: 10 }]);
    expect(r.outputs.out.TP).toBeLessThan(10);
  });

  it('emits metering pump + tank BoQ', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 30, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.capex!.lineItems.find(i => /pump/i.test(i.description))).toBeDefined();
    expect(r.capex!.lineItems.find(i => /tank/i.test(i.description))).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'daily dose');
  });
});

describe('UvDisinfection', () => {
  it('sizes lamp count from flow', () => {
    const unit = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.sizing?.lampCount.value).toBe(5);
    expect(r.energy?.installedKW).toBeCloseTo(5 * 0.25, 2);
  });

  it('picks larger reactor BoQ line for higher flow', () => {
    const small = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const large = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const rSmall = small.process([{ ...emptyWaterQuality(), flow: 400 }]);
    const rLarge = large.process([{ ...emptyWaterQuality(), flow: 3000 }]);
    expect(rLarge.capex!.total).toBeGreaterThan(rSmall.capex!.total);
  });

  it('passes flow through unchanged', () => {
    const unit = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, COD: 50 }]);
    expect(r.outputs.out.flow).toBe(1000);
    expect(r.outputs.out.COD).toBe(50);
  });
});

describe('InletPumping', () => {
  it('sizes kW from TDH and peak flow', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.energy?.installedKW).toBeGreaterThan(3);
    expect(r.energy?.installedKW).toBeLessThan(6);
  });

  it('includes duty + standby in BoQ (quantity = 2)', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    const pumps = r.capex!.lineItems.find(i => /pump/i.test(i.description));
    expect(pumps).toBeDefined();
    expect(pumps!.quantity).toBe(2);
  });

  it('passes water quality through unchanged', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, COD: 600 }]);
    expect(r.outputs.out.COD).toBe(600);
  });
});

describe("Phase 2 — UnitType registry", () => {
  it("includes all 9 new unit types in the union", () => {
    const newTypes: UnitType[] = [
      "screen", "grit_removal", "equalisation_tank", "mbr",
      "aeration_blower", "dewatering", "chemical_dosing",
      "uv_disinfection", "inlet_pumping",
    ];
    for (const t of newTypes) {
      expect(unitDefinitions[t], `Missing unit definition for "${t}"`).toBeDefined();
    }
  });
});
