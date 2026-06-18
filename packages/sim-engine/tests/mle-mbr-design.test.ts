import { describe, it, expect } from 'vitest';
import { designMleMbr, type MleMbrBasis } from '../src/design/mle-mbr';

/**
 * Validates the deterministic MLE-MBR engine against WWTP Design.xlsm's cached
 * cell values. The worked example overrides MLSS (10000) and anoxic fraction
 * (0.25) to match the sheet; production defaults are MLSS 12000 / 0.275.
 */
const XLSM_BASIS: MleMbrBasis = {
  adwfM3d: 70,
  codMgL: 900,
  tminC: 15,
  tmaxC: 25,
  elevationM: 1700,
  nitrogenRemoval: true,
  phosphorusRemoval: false,
  dischargeStandard: 'Special',
  mbrRequired: true,
  membraneModel: 'megavision',
  landUse: 'residential',
  overrides: { mlssMgL: 10000, anoxicMassFraction: 0.25 },
};

describe('designMleMbr — reproduces the WWTP Design.xlsm worked example', () => {
  const d = designMleMbr(XLSM_BASIS);

  it('flows (sheet 2)', () => {
    expect(d.flows.awwf).toBeCloseTo(77, 1);
    expect(d.flows.pdwf).toBeCloseTo(175, 1);
    expect(d.flows.pwwf).toBeCloseTo(192.5, 1);
  });

  it('derived influent + COD fractionation (sheets 0 & 1)', () => {
    expect(d.influent.TKN).toBeCloseTo(70, 0);
    expect(d.influent.TP).toBeCloseTo(15, 0);
    expect(d.influent.TSS).toBeCloseTo(360, 0);
    expect(d.influent.CODfiltered).toBeCloseTo(261, 0);
    expect(d.fractionation.USO).toBeCloseTo(54, 0);
    expect(d.fractionation.BSO).toBeCloseTo(207, 0);
    expect(d.fractionation.UPO).toBeCloseTo(135, 0);
    expect(d.fractionation.BPO).toBeCloseTo(504, 0);
    expect(d.fractionation.totalBiodegradable).toBeCloseTo(711, 0);
    expect(d.fractionation.fSbs).toBeCloseTo(0.2911, 3);
  });

  it('reactor sludge masses (sheet 4)', () => {
    expect(d.reactor.sludgeMass.Mbh).toBeCloseTo(87.3, 0);
    expect(d.reactor.sludgeMass.Mxeh).toBeCloseTo(72.6, 0);
    expect(d.reactor.sludgeMass.MXI).toBeCloseTo(127.6, 0);
    expect(d.reactor.sludgeMass.MXv).toBeCloseTo(287.5, 0);
    expect(d.reactor.sludgeMass.MXt).toBeCloseTo(401.4, 0);
  });

  it('reactor volume + sizing (sheets 4 & 5)', () => {
    expect(d.reactor.volumeMinM3).toBeCloseTo(40.1, 1);
    expect(d.reactor.volumeSelectedM3).toBeCloseTo(50.2, 1);
    expect(d.reactor.hrtTotalH).toBeCloseTo(13.76, 1);
    expect(d.reactor.aerobicVolumeM3).toBeCloseTo(37.6, 1);
    expect(d.reactor.anoxicVolumeM3).toBeCloseTo(12.5, 1);
    expect(d.reactor.aerobicHrtH).toBeCloseTo(12.9, 1);
    expect(d.reactor.anoxicHrtH).toBeCloseTo(4.3, 1);
    expect(d.reactor.wasM3d).toBeCloseTo(2.01, 1);
    expect(d.reactor.wasKgTssD).toBeCloseTo(20.1, 0);
  });

  it('nitrogen balance + effluent quality (sheet 4)', () => {
    expect(d.effluent.ammoniaMgL).toBeCloseTo(0.45, 1);
    expect(d.effluent.nitrateMgL).toBeCloseTo(10.55, 1);
    expect(d.effluent.nitrogenRemovalPct).toBeCloseTo(81.4, 0);
  });

  it('aeration: O2 demand + OTE (sheet 6)', () => {
    expect(d.aeration.o2OhoKgD).toBeCloseTo(37.9, 0);
    expect(d.aeration.o2NitrificationKgD).toBeCloseTo(16.9, 0);
    expect(d.aeration.o2TotalKgD).toBeCloseTo(46.4, 0);
    expect(d.aeration.oteFraction).toBeCloseTo(0.0257, 3);
  });

  it('MBR sizing (sheet 7)', () => {
    expect(d.mbr.membraneAreaM2).toBeCloseTo(327, -1); // 326.95, xlsm rounds modules to 328
    expect(d.mbr.moduleCount).toBe(2);
    expect(d.mbr.airScourNm3h).toBeCloseTo(294, -1); // xlsm 295.2
    expect(d.aeration.o2ScourCreditKgD).toBeCloseTo(23.2, 0); // xlsm 23.26
  });

  it('auto-sizes process air to MEET demand (vs the sheet\'s manual under-supply)', () => {
    // The xlsm manually selected 91 Nm³/hr (a ~6 kgO/d deficit); we compute the
    // air that actually meets the aerobic O2 demand, so it is higher.
    expect(d.aeration.processAirAm3h).toBeGreaterThan(122);
    expect(d.aeration.diffuserCount).toBeGreaterThanOrEqual(21);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(designMleMbr(XLSM_BASIS))).toBe(JSON.stringify(designMleMbr(XLSM_BASIS)));
  });
});

describe('designMleMbr — production defaults (spec)', () => {
  const basis: MleMbrBasis = { ...XLSM_BASIS, overrides: undefined };
  const d = designMleMbr(basis);

  it('uses MLSS 12000 and anoxic fraction 0.275', () => {
    expect(d.constants.mlssMgL).toBe(12000);
    expect(d.constants.anoxicMassFraction).toBe(0.275);
    // higher MLSS -> smaller reactor than the 10000 case
    expect(d.reactor.volumeSelectedM3).toBeLessThan(50.2);
  });

  it('NaOCl dosing per the spec formula (2 mg/L ÷ 150 g/L)', () => {
    expect(d.utilities.naoclLPerDay).toBeCloseTo((70 * 1000 * 2) / 150000, 2);
  });

  it('buffer/EQ tank = 0.5 × ADWF (12 h)', () => {
    const eq = d.tanks.find((t) => t.name.toLowerCase().includes('buffer'))!;
    expect(eq.volumeM3).toBeCloseTo(35, 0); // 0.5 × 70
    expect(eq.options).toHaveLength(2);
  });

  it('emits an auditable calculation trail', () => {
    expect(d.calculationRecords.length).toBeGreaterThan(8);
    expect(d.mbr.included).toBe(true);
  });
});
