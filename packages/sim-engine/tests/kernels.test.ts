import { describe, it, expect } from 'vitest';
import {
  fractionateCod,
  kineticsAtT,
  sludgeMasses,
  reactorSizing,
  nitrogenBalance,
  oxygenDemand,
  doSaturation,
  sitePressureKpa,
} from '../src/kernels';

/**
 * Kernel ground-truth check — the shared kernels must reproduce the
 * WWTP Design.xlsm (Marais-Ekama / WRC) cached values for the workbook's worked
 * example: ADWF 70 m³/d, raw COD 900 mg/L, SRT 20 d, MLSS 10000 mg/L,
 * anoxic mass fraction 0.25, Tmin 15 °C, MLE process.
 *
 * Every asserted number below is a cell value read from the workbook
 * (sheets 1, 3, 4, 5, 6). This is the independent validation that the kernels
 * are the spreadsheet — separate from the mle-mbr.ts refactor guard.
 */

// Worked-example basis (matches the xlsm sample/overrides).
const COD = 900;
const Q = 70;
const Rs = 20;
const MLSS = 10000;
const FXT = 0.25;
const T = 15;

const KIN_CONSTS = { muAm20: 0.45, Kn20: 1, bA20: 0.04, YH: 0.67, fcv: 1.481, bH20: 0.24 };

describe('kernels — WWTP Design.xlsm COD fractionation (sheet 1)', () => {
  it('splits raw COD 900 into the workbook BSO/USO/BPO/UPO', () => {
    const f = fractionateCod(COD, { fSup: 0.15, fSus: 0.06, codFilteredFraction: 0.29 });
    expect(f.soluble).toBeCloseTo(261, 6);              // 0.45 µm filtered (B5)
    expect(f.USO).toBeCloseTo(54, 6);                   // Susi (E26)
    expect(f.BSO).toBeCloseTo(207, 6);                  // Sbsi (B26)
    expect(f.UPO).toBeCloseTo(135, 6);                  // Supi (E30)
    expect(f.BPO).toBeCloseTo(504, 6);                  // Sbpi (B30)
    expect(f.totalBiodegradable).toBeCloseTo(711, 6);   // Sbi (B32)
    expect(f.totalUnbiodegradable).toBeCloseTo(189, 6); // (E32)
  });
});

describe('kernels — kinetics @ Tmin=15 (sheet 3)', () => {
  const k = kineticsAtT(KIN_CONSTS, T, Rs);
  it('reproduces the temperature-corrected kinetic constants', () => {
    expect(k.muAmT).toBeCloseTo(0.2519496, 6); // C7
    expect(k.KnT).toBeCloseTo(0.5598881, 6);   // C11
    expect(k.bAT).toBeCloseTo(0.0346723, 6);   // C13
    expect(k.Yhv).toBeCloseTo(0.4523970, 6);   // C22
    expect(k.bHT).toBeCloseTo(0.2080340, 6);   // C23 (bH @ Tmin)
    expect(k.C28).toBeCloseTo(1.7532457, 5);   // C28 (YH·Rs)/(1+bhT·Rs)
  });
});

describe('kernels — reactor sludge masses & volume (sheets 4–5)', () => {
  const k = kineticsAtT(KIN_CONSTS, T, Rs);
  const m = sludgeMasses(
    { fSup: 0.15, fcv: 1.481, fH: 0.2, fiOHO: 0.15 },
    { COD, totalBiodegradable: 711, ISS: 72, flow: Q }, // ISS = TSS 360 × 0.2 (sheet J3)
    Rs,
    k,
  );

  it('reproduces the workbook sludge inventory (sheet 4)', () => {
    expect(m.FSi).toBeCloseTo(63, 4);       // C20
    expect(m.FSbi).toBeCloseTo(49.77, 4);   // C21
    expect(m.FXii).toBeCloseTo(5.04, 4);    // C23
    expect(m.Mbh).toBeCloseTo(87.259, 2);   // C25
    expect(m.Mxeh).toBeCloseTo(72.611, 2);  // C26
    expect(m.MXI).toBeCloseTo(127.616, 2);  // C27
    expect(m.MXv).toBeCloseTo(287.487, 2);  // C28
    expect(m.MXIO).toBeCloseTo(113.889, 2); // C29
    expect(m.MXt).toBeCloseTo(401.376, 2);  // C30
  });

  it('reproduces the workbook reactor volume & zones (sheets 4–5)', () => {
    const r = reactorSizing(
      { mlssMgL: MLSS, volumeSafetyFactor: 1.25, anoxicMassFraction: FXT },
      m, Q, Rs, 'MLE',
    );
    expect(r.volumeMinM3).toBeCloseTo(40.1376, 3);     // sheet4 C32
    expect(r.hrtTotalH).toBeCloseTo(13.7615, 3);       // sheet4 C33
    expect(r.wasM3d).toBeCloseTo(2.00688, 4);          // sheet4 C35
    expect(r.volumeSelectedM3).toBeCloseTo(50.172, 2); // sheet5 C11
    expect(r.aerobicVolumeM3).toBeCloseTo(37.629, 2);  // sheet5 C14
    expect(r.anoxicVolumeM3).toBeCloseTo(12.543, 2);   // sheet5 C15
  });
});

describe('kernels — nitrogen balance & oxygen demand (sheets 4 & 6)', () => {
  const k = kineticsAtT(KIN_CONSTS, T, Rs);
  const m = sludgeMasses(
    { fSup: 0.15, fcv: 1.481, fH: 0.2, fiOHO: 0.15 },
    { COD, totalBiodegradable: 711, ISS: 72, flow: Q }, Rs, k,
  );
  const n = nitrogenBalance(
    { fnUPO: 0.072, alkalinityMgL: 220, aRecycle: 4, sRecycle: 0 },
    { TKN: 70, MXv: m.MXv, flow: Q, srtDays: Rs, config: 'MLE', nitrogenRemoval: true },
    k, FXT,
  );

  it('reproduces effluent N (sheet 4)', () => {
    expect(n.Ns).toBeCloseTo(14.785, 2);                 // C45
    expect(n.ammoniaMgL).toBeCloseTo(0.45457, 4);        // C51
    expect(n.tknMgL).toBeCloseTo(2.4546, 3);             // C52
    expect(n.nitrificationCapacity).toBeCloseTo(52.760, 2); // C53
    expect(n.nitrateMgL).toBeCloseTo(10.552, 2);         // C62
  });

  it('reproduces total oxygen demand FOc/FOn/FOdn/FOt (sheet 6)', () => {
    const o = oxygenDemand(
      { fcv: 1.481, fH: 0.2 },
      { FSbi: m.FSbi, flow: Q, nitrificationCapacity: n.nitrificationCapacity, nitrateMgL: n.nitrateMgL, srtDays: Rs },
      k,
    );
    expect(o.carbonaceousKgD).toBeCloseTo(37.9316, 2);       // C2
    expect(o.nitrificationKgD).toBeCloseTo(16.878, 2);       // C3
    expect(o.denitrificationCreditKgD).toBeCloseTo(8.4501, 2); // C4
    expect(o.totalKgD).toBeCloseTo(46.3595, 2);              // C5
  });
});

describe('kernels — physical helpers', () => {
  it('DO saturation and site pressure match the workbook polynomials', () => {
    // doSaturation is the APHA polynomial the workbook's aeration math uses
    // (sheet 6 C16/C17 column); note this differs slightly from the workbook's
    // separate DO-vs-elevation lookup table (Q40 = 9.092) — the polynomial is
    // the one mle-mbr.ts/the OTE chain consumes.
    expect(doSaturation(20)).toBeCloseTo(9.022, 2);
    expect(sitePressureKpa(1700)).toBeCloseTo(82.501, 2); // sheet6 C23 (Pb)
  });
});
