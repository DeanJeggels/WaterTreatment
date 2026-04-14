import { describe, it, expect } from 'vitest';
import {
  Influent,
  PrimaryClarifier,
  BioreactorAerobic,
  BioreactorAnoxic,
  BioreactorAnaerobic,
  SecondaryClarifier,
  Splitter,
  Mixer,
  Thickener,
  Effluent,
  checkCompliance,
  createUnit,
} from '../src/units/index';
import { emptyWaterQuality, mixStreams } from '../src/types';
import type { WaterQuality } from '../src/types';
import { assertValidV2Outputs } from './helpers/v2-outputs';

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
