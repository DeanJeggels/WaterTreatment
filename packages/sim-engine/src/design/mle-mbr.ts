/**
 * MLE-MBR preliminary design engine — a DETERMINISTIC, rule-based replication of
 * the WWTP Design.xlsm Marais-Ekama / WRC (Ekama 1984, WRC TT-16/84) workbook
 * (sheets 0–7 + Summary). Given a small design basis it produces the full
 * preliminary design (flows, derived influent, COD fractionation, bioreactor
 * sizing, aeration, MBR, solids, utilities, tank options) plus an auditable
 * calculation trail. No AI, no clocks, no randomness — same basis → same design.
 *
 * Validated cell-for-cell against the workbook's cached values (see tests).
 * Constants default to the design SPEC; the worked example reproduces the xlsm
 * by overriding MLSS/anoxic-fraction.
 */
import type { CalculationRecord } from '../types/calculation-record';
import {
  fractionateCod, kineticsAtT, sludgeMasses, reactorSizing,
  nitrogenBalance, oxygenDemand, aerationTransfer, membraneSizing,
} from '../kernels';

export type DischargeStandard = 'General' | 'Special';
export type MembraneModel = 'megavision' | 'memstar';
export type LandUse = 'residential' | 'commercial' | 'shopping_centre' | 'hospital' | 'industrial';
export type ProcessConfig = 'MLE' | 'A2O_UCT' | 'aerobic';

export interface MleMbrBasis {
  /** Average dry-weather flow, m³/d. */
  adwfM3d: number;
  /** Raw influent total COD, mg/L. */
  codMgL: number;
  tminC: number;
  tmaxC: number;
  elevationM: number;
  nitrogenRemoval: boolean;
  phosphorusRemoval: boolean;
  dischargeStandard: DischargeStandard;
  mbrRequired: boolean;
  membraneModel: MembraneModel;
  landUse: LandUse;
  /** Optional overrides (the worked-example test uses these to match the xlsm). */
  overrides?: Partial<MleMbrConstants>;
}

export interface MleMbrConstants {
  peakFactor: number;
  awwfFactor: number;
  volumeSafetyFactor: number;
  sludgeAgeDays: number; // SRT
  mlssMgL: number;
  anoxicMassFraction: number; // fxt
  anaerobicMassFraction: number; // fan — extra unaerated fraction for UCT (EBPR); fxm = fxt + fan
  aRecycle: number;
  sRecycle: number;
  rRecycle: number;
  doARecycle: number;
  // kinetics / stoichiometry
  YH: number;
  fH: number;
  fcv: number;
  fiOHO: number;
  fnUPO: number;
  fSup: number; // unbiodeg particulate COD fraction
  fSus: number; // unbiodeg soluble COD fraction
  codFilteredFraction: number; // soluble COD / total COD
  // influent estimation ratios — master prompt universal defaults (Stage 2)
  tknPerCod: number;
  tpPerCod: number;
  tssPerCod: number;
  bodPerCod: number;
  tocPerCod: number;
  fogPerCod: number;
  fsaPerTkn: number;
  opPerTp: number;
  issPerTss: number;
  alkalinityMgL: number;
  // nitrifier kinetics @20
  muAm20: number;
  Kn20: number;
  bA20: number;
  // aeration
  alpha: number;
  beta: number;
  foulingFactor: number;
  diffuserDepthM: number;
  diffuserAirflowNm3h: number; // per diffuser
  minDOmgL: number;
  // MBR
  mbrOpDurationH: number;
  mbrMembranePeakFactor: number; // ×AWWF over the operational window
  // master-spec ancillaries
  sewageReturnFraction: number; // sewage return factor (water-demand → ADWF)
  naoclStorageDays: number; // NaOCl bulk storage basis
  permeateTssMgL: number; // MBR permeate quality (deterministic effluent)
  permeateCodMgL: number;
}

const DEFAULTS: MleMbrConstants = {
  peakFactor: 2.5,
  awwfFactor: 1.1,
  volumeSafetyFactor: 1.25,
  sludgeAgeDays: 20,
  mlssMgL: 12000, // SPEC default for MBR (xlsm worked example used 10000)
  anoxicMassFraction: 0.275, // SPEC default (xlsm used 0.25)
  anaerobicMassFraction: 0.1, // UCT anaerobic (EBPR) zone — extra unaerated fraction (sheet 5: fxm − fxt)
  aRecycle: 4,
  sRecycle: 0,
  rRecycle: 1,
  doARecycle: 2,
  YH: 0.67,
  fH: 0.2,
  fcv: 1.481,
  fiOHO: 0.15,
  fnUPO: 0.072,
  fSup: 0.15,
  fSus: 0.06,
  codFilteredFraction: 0.29,
  tknPerCod: 0.075,
  tpPerCod: 0.015,
  tssPerCod: 0.45,
  bodPerCod: 0.44,
  tocPerCod: 0.375,
  fogPerCod: 0.011,
  fsaPerTkn: 0.75,
  opPerTp: 0.6,
  issPerTss: 0.2,
  alkalinityMgL: 220,
  muAm20: 0.45,
  Kn20: 1,
  bA20: 0.04,
  alpha: 0.45,
  beta: 0.95,
  foulingFactor: 0.9,
  diffuserDepthM: 2.2,
  diffuserAirflowNm3h: 6,
  minDOmgL: 2,
  mbrOpDurationH: 19.2,
  mbrMembranePeakFactor: 1.5,
  sewageReturnFraction: 0.7,
  naoclStorageDays: 30,
  permeateTssMgL: 2,
  permeateCodMgL: 40,
};

interface MembraneSpec {
  label: string;
  fluxLmh: number;
  /** Nm³/hr air scour per m² coefficient: scour = coeff × area / 1000 × 60. */
  scourCoeff: number;
  /** Nominal SMU module membrane area, m² (flagged assumption for module count). */
  nominalModuleAreaM2: number;
  /** SMU module envelope volume, m³ (CIP tank = 1.5 × this × module count). */
  moduleVolumeM3: number;
}

const MEMBRANES: Record<MembraneModel, MembraneSpec> = {
  megavision: { label: 'Megavision hollow fibre', fluxLmh: 18.4, scourCoeff: 15, nominalModuleAreaM2: 200, moduleVolumeM3: 2.0 },
  memstar: { label: 'Memstar hollow fibre', fluxLmh: 20, scourCoeff: 9, nominalModuleAreaM2: 200, moduleVolumeM3: 1.6 },
};

// ---- helpers ----
const round = (x: number, dp = 3): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const ceil = Math.ceil;
// DO saturation, site pressure and SOTE-from-depth now live in the shared
// kernels (wastewater.ts / aeration.ts) and are used via aerationTransfer().

const rec = (
  label: string,
  symbol: string,
  equation: string,
  inputs: Record<string, { value: number; unit: string; source: string }>,
  value: number,
  unit: string,
  citation = 'WWTP Design.xlsm (Marais-Ekama / WRC TT-16/84)',
): CalculationRecord => ({ label, symbol, equation, inputs, result: { value: round(value, 4), unit }, citation });

// ---- output shape ----
export interface DerivedInfluent {
  COD: number; CODfiltered: number; BOD: number; TOC: number;
  TKN: number; FSA: number; TP: number; OP: number; TSS: number; ISS: number; FOG: number; alkalinity: number; pH: number;
}
export interface CodFractionation { USO: number; BSO: number; UPO: number; BPO: number; totalBiodegradable: number; totalUnbiodegradable: number; fSbs: number; }
export interface FlowSet { adwf: number; awwf: number; pdwf: number; pwwf: number; sewageReturnFraction: number; }
export interface TankOption { label: string; lengthM: number; widthM: number; depthM: number; volumeM3: number; }
export interface SizedTank { name: string; volumeM3: number; options: [TankOption, TankOption]; }

export interface MleMbrDesign {
  basis: MleMbrBasis;
  constants: MleMbrConstants;
  process: { config: ProcessConfig; minSludgeAgeDays: number; sludgeAgeDays: number; mlssMgL: number; trains: number; recycle: { a: number; s: number; r: number }; massFractions: { anoxic: number; anaerobic: number; unaerated: number } };
  flows: FlowSet;
  influent: DerivedInfluent;
  fractionation: CodFractionation;
  reactor: {
    sludgeMass: { Mbh: number; Mxeh: number; MXI: number; MXv: number; MXIO: number; MXt: number };
    volumeMinM3: number; volumeSelectedM3: number; hrtTotalH: number;
    aerobicVolumeM3: number; anoxicVolumeM3: number; anaerobicVolumeM3: number;
    aerobicHrtH: number; anoxicHrtH: number; anaerobicHrtH: number;
    wasM3d: number; wasKgTssD: number;
  };
  effluent: { ammoniaMgL: number; nitrateMgL: number; tknMgL: number; nitrogenRemovalPct: number; effluentAlkalinityMgL: number; permeateTssMgL: number; permeateCodMgL: number };
  aeration: {
    o2OhoKgD: number; o2NitrificationKgD: number; o2DenitCreditKgD: number; o2ScourCreditKgD: number; o2TotalKgD: number;
    soteFraction: number; oteFraction: number;
    processAirNm3h: number; processAirAm3h: number; diffuserCount: number; blowerKW: number;
  };
  mbr: {
    included: boolean; model: string; fluxLmh: number; membraneAreaM2: number; moduleCount: number; moduleAreaM2: number;
    permeateDutyM3h: number; airScourNm3h: number; airScourAm3h: number; scourBlowerKW: number; cipTankM3: number;
  };
  tanks: SizedTank[];
  solids: { wasM3d: number; wasTssMgL: number; wasVssMgL: number; thickeningSiloM3: number; thickening: string; dewatering: string };
  utilities: { installedKW: number; dutyKW: number; energyKwhPerM3: number; naoclLPerDay: number; naoclLPerHour: number; naoclStorageDays: number; naoclStorageM3: number; cipAcidLPerDay: number; serviceWaterM3d: number };
  calculationRecords: CalculationRecord[];
  warnings: string[];
}

export function designMleMbr(basis: MleMbrBasis): MleMbrDesign {
  const k: MleMbrConstants = { ...DEFAULTS, ...basis.overrides };
  const records: CalculationRecord[] = [];
  const warnings: string[] = [];
  const Q = basis.adwfM3d;
  const Rs = k.sludgeAgeDays;

  // ---- [2] Flows ----
  const awwf = Q * k.awwfFactor;
  const pdwf = Q * k.peakFactor;
  const pwwf = awwf * k.peakFactor;
  const flows: FlowSet = { adwf: round(Q, 1), awwf: round(awwf, 1), pdwf: round(pdwf, 1), pwwf: round(pwwf, 1), sewageReturnFraction: k.sewageReturnFraction };
  records.push(rec('Average wet-weather flow', 'AWWF', 'AWWF = ADWF × awwfFactor', { ADWF: { value: Q, unit: 'm3/d', source: 'user input' } }, awwf, 'm3/d'));
  records.push(rec('Peak wet-weather flow', 'PWWF', 'PWWF = AWWF × PF', { AWWF: { value: awwf, unit: 'm3/d', source: 'computed' }, PF: { value: k.peakFactor, unit: '', source: 'default' } }, pwwf, 'm3/d'));

  // ---- [0/1] Derived influent (master universal ratios) + COD fractionation ----
  const COD = basis.codMgL;
  const TKN = COD * k.tknPerCod;
  const TP = COD * k.tpPerCod;
  const TSS = COD * k.tssPerCod;
  const influent: DerivedInfluent = {
    COD, CODfiltered: COD * k.codFilteredFraction, BOD: COD * k.bodPerCod, TOC: COD * k.tocPerCod,
    TKN, FSA: TKN * k.fsaPerTkn, TP, OP: TP * k.opPerTp, TSS, ISS: TSS * k.issPerTss, FOG: COD * k.fogPerCod,
    alkalinity: k.alkalinityMgL, pH: 7.5,
  };
  const frac = fractionateCod(COD, { fSup: k.fSup, fSus: k.fSus, codFilteredFraction: k.codFilteredFraction });
  const { USO, BSO, UPO, BPO } = frac;
  const totalBiodeg = frac.totalBiodegradable;
  const totalUnbiodeg = frac.totalUnbiodegradable;
  const fractionation: CodFractionation = {
    USO: round(USO, 1), BSO: round(BSO, 1), UPO: round(UPO, 1), BPO: round(BPO, 1),
    totalBiodegradable: round(totalBiodeg, 1), totalUnbiodegradable: round(totalUnbiodeg, 1), fSbs: round(BSO / totalBiodeg, 4),
  };
  records.push(rec('Influent TKN (derived)', 'Nti', 'TKN = COD × ratio(landUse)', { COD: { value: COD, unit: 'mg/L', source: 'user input' } }, TKN, 'mgN/L', `Land-use estimation ratio (${basis.landUse})`));
  records.push(rec('Total biodegradable COD', 'Sbi', 'Sbi = BSO + BPO', { BSO: { value: BSO, unit: 'mg/L', source: 'fractionation' }, BPO: { value: BPO, unit: 'mg/L', source: 'fractionation' } }, totalBiodeg, 'mgCOD/L'));

  // ---- Process selection ----
  let config: ProcessConfig = 'aerobic';
  if (basis.nitrogenRemoval && basis.phosphorusRemoval) config = 'A2O_UCT';
  else if (basis.nitrogenRemoval) config = 'MLE';

  // ---- [3] Kinetics @ Tmin ----
  const T = basis.tminC;
  const kin = kineticsAtT(
    { muAm20: k.muAm20, Kn20: k.Kn20, bA20: k.bA20, YH: k.YH, fcv: k.fcv, bH20: 0.24 },
    T, Rs,
  );
  const { muAmT, KnT, bAT, Yhv } = kin;
  const bHTmin = kin.bHT;
  const C28 = kin.C28; // (YH·Rs)/(1+bhT·Rs)

  // ---- [4] Sludge masses ----
  const masses = sludgeMasses(
    { fSup: k.fSup, fcv: k.fcv, fH: k.fH, fiOHO: k.fiOHO },
    { COD, totalBiodegradable: totalBiodeg, ISS: influent.ISS, flow: Q },
    Rs, kin,
  );
  const { FSi, FSbi, FXii, Mbh, Mxeh, MXI, MXv, MXIO, MXt } = masses;
  records.push(rec('Biomass in reactor', 'Mbh', 'Mbh = FSbi × (YH·Rs)/(1+bhT·Rs)', { FSbi: { value: FSbi, unit: 'kgCOD/d', source: 'computed' }, factor: { value: C28, unit: '', source: 'kinetics' } }, Mbh, 'kgVSS'));
  records.push(rec('Total TSS in reactor', 'MXt', 'MXt = MXIO + MXv', { MXIO: { value: MXIO, unit: 'kgISS', source: 'computed' }, MXv: { value: MXv, unit: 'kgVSS', source: 'computed' } }, MXt, 'kgTSS'));

  // ---- [4/5] Reactor volume + sizing ----
  const sizing = reactorSizing(
    {
      mlssMgL: k.mlssMgL, volumeSafetyFactor: k.volumeSafetyFactor,
      anoxicMassFraction: k.anoxicMassFraction, anaerobicMassFraction: k.anaerobicMassFraction,
    },
    masses, Q, Rs, config,
  );
  const Vmin = sizing.volumeMinM3;
  const hrtTotal = sizing.hrtTotalH;
  const Qw = sizing.wasM3d;
  const FXw = sizing.wasKgTssD;
  const Vt = sizing.volumeSelectedM3;
  const { fxt, fan } = sizing;
  const Va = sizing.aerobicVolumeM3;
  const Vax = sizing.anoxicVolumeM3;
  const Van = sizing.anaerobicVolumeM3;
  records.push(rec('Total reactor volume (min)', 'Vmin', 'Vmin = MXt / MLSS × 1000', { MXt: { value: MXt, unit: 'kgTSS', source: 'computed' }, MLSS: { value: k.mlssMgL, unit: 'mg/L', source: 'default' } }, Vmin, 'm3'));
  records.push(rec('Total reactor volume (selected)', 'Vt', 'Vt = Vmin × safety', { Vmin: { value: Vmin, unit: 'm3', source: 'computed' }, safety: { value: k.volumeSafetyFactor, unit: '', source: 'default' } }, Vt, 'm3'));
  records.push(rec('Sludge waste rate', 'Qw', 'Qw = Vmin / Rs', { Vmin: { value: Vmin, unit: 'm3', source: 'computed' }, Rs: { value: Rs, unit: 'd', source: 'default' } }, Qw, 'm3/d'));
  // Zone split (WWTP Design.xlsm sheet 5). MLE: Va = Vt(1−fxt), Van = 0. UCT: an
  // anaerobic (EBPR) zone is carved out — fxm = fxt + fan is the total unaerated
  // mass fraction, Va = Vt(1−fxm), Vax = Vt·fxt, Van = Vt(fxm−fxt) = Vt·fan.
  records.push(rec('Anoxic zone volume', 'Vax', 'Vax = Vt × fxt', { Vt: { value: Vt, unit: 'm3', source: 'computed' }, fxt: { value: fxt, unit: '', source: 'anoxic mass fraction' } }, Vax, 'm3', 'WWTP Design.xlsm sheet 5 C15'));
  if (config === 'A2O_UCT') {
    records.push(rec('Anaerobic (EBPR) zone volume', 'Van', 'Van = Vt × fan  (fan = fxm − fxt)', { Vt: { value: Vt, unit: 'm3', source: 'computed' }, fan: { value: fan, unit: '', source: 'anaerobic mass fraction (UCT)' } }, Van, 'm3', 'WWTP Design.xlsm sheet 5 C16'));
  }
  records.push(rec('Aerobic zone volume', 'Va', config === 'A2O_UCT' ? 'Va = Vt × (1 − fxm)' : 'Va = Vt × (1 − fxt)', { Vt: { value: Vt, unit: 'm3', source: 'computed' }, fxm: { value: fxt + fan, unit: '', source: 'total unaerated mass fraction' } }, Va, 'm3', 'WWTP Design.xlsm sheet 5 C14'));

  // ---- [4] Nitrogen balance ----
  const nbal = nitrogenBalance(
    { fnUPO: k.fnUPO, alkalinityMgL: influent.alkalinity, aRecycle: k.aRecycle, sRecycle: k.sRecycle },
    { TKN: influent.TKN, MXv, flow: Q, srtDays: Rs, config, nitrogenRemoval: basis.nitrogenRemoval },
    kin, fxt, fan,
  );
  const Ns = nbal.Ns;
  const Nae = nbal.ammoniaMgL;
  const USOrgN = 2; // typical unbiodegradable soluble organic N (xlsm Nousi)
  const TKNe = nbal.tknMgL;
  const Nc = nbal.nitrificationCapacity;
  const Nne = nbal.nitrateMgL;
  const nRemovalPct = basis.nitrogenRemoval ? ((influent.TKN - (USOrgN + Nne + Nae)) / influent.TKN) * 100 : 0;
  const alkConsumed = nbal.alkConsumed;
  const alkRecovered = nbal.alkRecovered;
  const effAlk = nbal.effluentAlkalinityMgL;
  if (effAlk < 40) warnings.push(`Effluent alkalinity ${round(effAlk, 0)} mg/L < 40 — lime dosing may be required to prevent bulking.`);
  records.push(rec('Effluent ammonia', 'Nae', 'Nae = KnT(bAT+1/Rs) / (μAmT(1-fxm) - (bAT+1/Rs)),  fxm = fxt + fan', { KnT: { value: KnT, unit: 'mgN/L', source: 'kinetics' }, muAmT: { value: muAmT, unit: '1/d', source: 'kinetics' }, fxm: { value: fxt + fan, unit: '', source: 'total unaerated mass fraction' } }, Nae, 'mgN/L'));
  records.push(rec('Effluent nitrate', 'Nne', 'Nne = Nc / (a+s+1)', { Nc: { value: Nc, unit: 'mgN/L', source: 'computed' }, a: { value: k.aRecycle, unit: '', source: 'default' } }, Nne, 'mgNO3/L'));

  // ---- [7] MBR (before aeration: scour O2 credits aeration) ----
  const m = MEMBRANES[basis.membraneModel];
  // Site air-transfer correction (shared by the MBR scour and the aeration math).
  const transfer = aerationTransfer(
    { alpha: k.alpha, beta: k.beta, foulingFactor: k.foulingFactor, diffuserDepthM: k.diffuserDepthM, minDOmgL: k.minDOmgL },
    T, basis.elevationM,
  );
  const am3hFactor = transfer.am3hFactor;
  const mbrSizing = membraneSizing(
    { fluxLmh: m.fluxLmh, scourCoeff: m.scourCoeff, scourByArea: basis.membraneModel === 'megavision', nominalModuleAreaM2: m.nominalModuleAreaM2 },
    { membranePeakFactor: k.mbrMembranePeakFactor, opDurationH: k.mbrOpDurationH, diffuserDepthM: k.diffuserDepthM },
    awwf, basis.mbrRequired,
  );
  const flowToTreat = mbrSizing.permeateDutyM3h; // m³/hr
  const membraneAreaReq = mbrSizing.membraneAreaM2; // m²
  const moduleCount = mbrSizing.moduleCount;
  const moduleArea = mbrSizing.moduleAreaM2;
  const scourNm3h = mbrSizing.airScourNm3h;
  const scourAm3h = scourNm3h * am3hFactor;
  const scourO2KgD = mbrSizing.scourO2CreditKgD;
  records.push(rec('MBR membrane area required', 'Am', 'Am = (flowToTreat × 1000) / flux', { flowToTreat: { value: flowToTreat, unit: 'm3/hr', source: 'AWWF×1.5/opDuration' }, flux: { value: m.fluxLmh, unit: 'LMH', source: 'membrane' } }, membraneAreaReq, 'm2'));
  records.push(rec('MBR air scour', 'Qscour', basis.membraneModel === 'megavision' ? 'Qscour = 15 × area/1000 × 60' : 'Qscour = 9 × modules', { area: { value: membraneAreaReq, unit: 'm2', source: 'computed' } }, scourNm3h, 'Nm3/hr'));

  // ---- [6] Aeration ----
  const odem = oxygenDemand(
    { fcv: k.fcv, fH: k.fH },
    { FSbi, flow: Q, nitrificationCapacity: Nc, nitrateMgL: Nne, srtDays: Rs },
    kin,
  );
  const FOc = odem.carbonaceousKgD;
  const FOn = odem.nitrificationKgD;
  const FOdn = odem.denitrificationCreditKgD;
  const FOt = odem.totalKgD;
  const sote = transfer.soteFraction;
  const ote = transfer.oteFraction;
  const oteOverSote = sote > 0 ? ote / sote : 0; // for the audit record below
  const aerobicO2 = Math.max(0, FOt - scourO2KgD);
  const processAirNm3h = aerobicO2 / (0.21 * 1.421 * ote * 24);
  const processAirAm3h = processAirNm3h * am3hFactor;
  const diffuserCount = Math.max(1, ceil(processAirAm3h / k.diffuserAirflowNm3h));
  records.push(rec('Total oxygen demand', 'FOt', 'FOt = FOc + FOn − FOdn', { FOc: { value: FOc, unit: 'kgO/d', source: 'computed' }, FOn: { value: FOn, unit: 'kgO/d', source: 'computed' }, FOdn: { value: FOdn, unit: 'kgO/d', source: 'computed' } }, FOt, 'kgO/d'));
  records.push(rec('Overall oxygen transfer efficiency', 'OTE', 'OTE = (OTE/SOTE) × SOTE', { sote: { value: sote, unit: '', source: 'interp(depth)' }, factor: { value: oteOverSote, unit: '', source: 'site correction' } }, ote, '-'));
  records.push(rec('Process air supply', 'Qair', 'Qair = aerobicO2 / (0.21×1.421×OTE×24)', { aerobicO2: { value: aerobicO2, unit: 'kgO2/d', source: 'FOt − scour credit' }, OTE: { value: ote, unit: '', source: 'computed' } }, processAirAm3h, 'Am3/hr'));

  // ---- blower kW ----
  const blowerDP = (k.diffuserDepthM * 9.81 + 15) * 1000; // Pa
  const blowerKW = (processAirAm3h * blowerDP) / (3600 * 1000 * 0.72);
  const scourDP = (k.diffuserDepthM * 9.81 + 15) * 1000;
  const scourBlowerKW = (scourAm3h * scourDP) / (3600 * 1000 * 0.72);

  // ---- Tanks (buffer/EQ + anoxic + aerobic/MBR), two layout options each ----
  const eqVol = 0.5 * Q; // 12 h buffer
  const mkTank = (name: string, volM3: number, depthM: number): SizedTank => {
    const area = volM3 / depthM;
    const lenSquare = Math.sqrt(area);
    const optA: TankOption = { label: 'Square RC tank', lengthM: round(lenSquare, 2), widthM: round(lenSquare, 2), depthM, volumeM3: round(volM3, 1) };
    const len2 = Math.sqrt(2 * area);
    const optB: TankOption = { label: 'Rectangular (2:1) RC tank', lengthM: round(len2, 2), widthM: round(len2 / 2, 2), depthM, volumeM3: round(volM3, 1) };
    return { name, volumeM3: round(volM3, 1), options: [optA, optB] };
  };
  const tankDepth = 4.5;
  const tanks: SizedTank[] = [
    mkTank('Buffer / equalisation tank', eqVol, tankDepth),
    ...(Vax > 0 ? [mkTank('Anoxic tank', Vax, tankDepth)] : []),
    mkTank('Aeration tank with MBR', Va, tankDepth),
  ];

  // ---- Utilities ----
  const mixerKW = Math.max(1, ceil((Vax + eqVol) / 500)) * 3;
  const uvKW = Math.max(1, ceil(awwf / 200)) * 0.25;
  const permeatePumpKW = Math.max(1.1, flowToTreat * 0.05);
  const installedKW = blowerKW + scourBlowerKW + mixerKW + uvKW + permeatePumpKW;
  const dutyKW = installedKW * 0.85;
  const energyKwhPerM3 = (dutyKW * 24) / Q;
  const naoclLPerDay = (Q * 1000 * 2) / 150000; // 2 mg/L Cl, 150 g/L NaOCl
  const naoclLPerHour = naoclLPerDay / 24;
  const naoclStorageM3 = round((naoclLPerDay * k.naoclStorageDays) / 1000, 2); // bulk storage
  const cipAcidLPerDay = round(membraneAreaReq * 0.002, 2); // citric/HCl CIP estimate
  const serviceWaterM3d = round(Q * 0.02, 2);
  // CIP tank = 1.5 × membrane module envelope volume × module count
  const cipTankM3 = round(1.5 * moduleCount * m.moduleVolumeM3, 2);
  // Sludge thickening silo — 3-day WAS buffer at ~2.5× thickening
  const thickeningSiloM3 = round(Qw * 3 * 0.4, 2);

  if (k.mlssMgL > 12000) warnings.push(`MLSS ${k.mlssMgL} mg/L above the typical MBR ceiling (8000–12000).`);
  if (config === 'A2O_UCT') warnings.push(`UCT process: anaerobic (EBPR) zone = ${round(Van, 1)} m³ (fan = ${round(fan, 3)} of the reactor mass), fed by the influent + r-recycle from the anoxic zone (nitrate-free) to protect P-release. Confirm the influent VFA / rbCOD supports the target P removal at detailed design.`);

  return {
    basis,
    constants: k,
    process: { config, minSludgeAgeDays: round((1 + fxt) / (muAmT - bAT), 1), sludgeAgeDays: Rs, mlssMgL: k.mlssMgL, trains: 1, recycle: { a: k.aRecycle, s: k.sRecycle, r: k.rRecycle }, massFractions: { anoxic: round(fxt, 3), anaerobic: round(fan, 3), unaerated: round(fxt + fan, 3) } },
    flows,
    influent: Object.fromEntries(Object.entries(influent).map(([key, v]) => [key, round(v, 1)])) as unknown as DerivedInfluent,
    fractionation,
    reactor: {
      sludgeMass: { Mbh: round(Mbh, 1), Mxeh: round(Mxeh, 1), MXI: round(MXI, 1), MXv: round(MXv, 1), MXIO: round(MXIO, 1), MXt: round(MXt, 1) },
      volumeMinM3: round(Vmin, 1), volumeSelectedM3: round(Vt, 1), hrtTotalH: round(hrtTotal, 2),
      aerobicVolumeM3: round(Va, 1), anoxicVolumeM3: round(Vax, 1), anaerobicVolumeM3: round(Van, 1),
      aerobicHrtH: round((Va / Q) * 24, 2), anoxicHrtH: round((Vax / Q) * 24, 2), anaerobicHrtH: round((Van / Q) * 24, 2),
      wasM3d: round(Qw, 2), wasKgTssD: round(FXw, 1),
    },
    effluent: { ammoniaMgL: round(Math.max(0, Nae), 2), nitrateMgL: round(Nne, 2), tknMgL: round(TKNe, 2), nitrogenRemovalPct: round(nRemovalPct, 1), effluentAlkalinityMgL: round(effAlk, 0), permeateTssMgL: k.permeateTssMgL, permeateCodMgL: k.permeateCodMgL },
    aeration: {
      o2OhoKgD: round(FOc, 2), o2NitrificationKgD: round(FOn, 2), o2DenitCreditKgD: round(FOdn, 2), o2ScourCreditKgD: round(scourO2KgD, 2), o2TotalKgD: round(FOt, 2),
      soteFraction: round(sote, 4), oteFraction: round(ote, 5),
      processAirNm3h: round(processAirNm3h, 1), processAirAm3h: round(processAirAm3h, 1), diffuserCount, blowerKW: round(blowerKW, 2),
    },
    mbr: {
      included: basis.mbrRequired, model: m.label, fluxLmh: m.fluxLmh, membraneAreaM2: round(membraneAreaReq, 0), moduleCount, moduleAreaM2: round(moduleArea, 0),
      permeateDutyM3h: round(flowToTreat, 2), airScourNm3h: round(scourNm3h, 1), airScourAm3h: round(scourAm3h, 1), scourBlowerKW: round(scourBlowerKW, 2), cipTankM3,
    },
    tanks,
    solids: { wasM3d: round(Qw, 2), wasTssMgL: k.mlssMgL, wasVssMgL: round(k.mlssMgL * 0.72, 0), thickeningSiloM3, thickening: 'Gravity thickener / picket-fence', dewatering: 'Belt press or screw press' },
    utilities: { installedKW: round(installedKW, 1), dutyKW: round(dutyKW, 1), energyKwhPerM3: round(energyKwhPerM3, 2), naoclLPerDay: round(naoclLPerDay, 2), naoclLPerHour: round(naoclLPerHour, 3), naoclStorageDays: k.naoclStorageDays, naoclStorageM3, cipAcidLPerDay, serviceWaterM3d },
    calculationRecords: records,
    warnings,
  };
}
