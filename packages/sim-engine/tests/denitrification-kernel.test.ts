import { describe, it, expect } from 'vitest';
import {
  denitrificationRateK1,
  denitrificationRateK2,
  denitrificationPotential,
  denitrifiedNitrate,
} from '../src/kernels/denitrification';

/**
 * Denitrification kernel ground-truth check — reproduces the WWTP Design.xlsm
 * (Marais-Ekama / WRC) cached values for the workbook's denitrification worked
 * example: Tmin 15 °C, K2,20 = 0.101, Rs 20 d, CODbi (Sbi) 711 mg/L,
 * fSbs 0.2911392, anoxic mass fraction fxt 0.25, Yhv 0.4523970, bHT 0.2080340,
 * fcv 1.481.
 *
 * Asserted numbers are cell values read from sheets 3 (kinetics) and 4
 * (denitrification potential Dp1).
 */

const T = 15;
const K2_20 = 0.101;
const Rs = 20;
const CODbi = 711;
const fSbs = 0.2911392;
const fxt = 0.25;
const Yhv = 0.4523970;
const bHT = 0.2080340;
const fcv = 1.481;

describe('denitrification — anoxic specific rates @ Tmin=15 (sheet 3)', () => {
  it('reproduces K2,T from the Arrhenius correction (theta 1.08)', () => {
    const K2T = denitrificationRateK2(T, K2_20);
    expect(K2T).toBeCloseTo(0.0687389, 6); // sheet3 C17
  });

  it('reproduces K1,T from the Arrhenius correction (theta 1.2)', () => {
    const K1T = denitrificationRateK1(T); // default K1,20 = 0.72
    expect(K1T).toBeCloseTo(0.2893519, 6); // 0.72 × 1.2^(15−20)
  });

  it('uses the documented defaults when constants are omitted', () => {
    expect(denitrificationRateK2(20)).toBeCloseTo(0.101, 6);
    expect(denitrificationRateK1(20)).toBeCloseTo(0.72, 6);
  });
});

describe('denitrification — first-anoxic denitrification potential Dp1 (sheet 4)', () => {
  it('reproduces Dp1 for the workbook worked example', () => {
    const K2T = denitrificationRateK2(T, K2_20);
    const Dp1 = denitrificationPotential(
      { CODbi, fSbs, fxt, srtDays: Rs },
      { Yhv, bHT },
      K2T,
      { fcv },
    );
    expect(Dp1).toBeCloseTo(45.3064, 3); // sheet4 C55
  });
});

describe('denitrification — capacity-limited nitrate removal', () => {
  const Dp = 45.3064;

  it('removes the full nitrate when potential exceeds the load', () => {
    expect(denitrifiedNitrate(10, Dp)).toBeCloseTo(10, 6);
  });

  it('caps removal at the denitrification potential', () => {
    expect(denitrifiedNitrate(60, Dp)).toBeCloseTo(Dp, 6);
  });

  it('never returns a negative removal', () => {
    expect(denitrifiedNitrate(-5, Dp)).toBe(0);
    expect(denitrifiedNitrate(10, -3)).toBe(0);
  });
});
