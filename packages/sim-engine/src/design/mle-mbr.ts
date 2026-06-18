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
}

const DEFAULTS: MleMbrConstants = {
  peakFactor: 2.5,
  awwfFactor: 1.1,
  volumeSafetyFactor: 1.25,
  sludgeAgeDays: 20,
  mlssMgL: 12000, // SPEC default for MBR (xlsm worked example used 10000)
  anoxicMassFraction: 0.275, // SPEC default (xlsm used 0.25)
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
};

/** Influent estimation ratios per land use (municipal/residential grounded in the xlsm example). */
interface LandUseRatios {
  tknPerCod: number;
  tpPerCod: number;
  tssPerCod: number;
  tocPerCod: number;
  bodPerCod: number;
  fogPerCod: number;
  fsaPerTkn: number;
  opPerTp: number;
  alkalinityMgL: number;
}

const LAND_USE_RATIOS: Record<LandUse, LandUseRatios> = {
  // Grounded in WWTP Design.xlsm "Example 1" (COD 900 → TKN 70, TP 15, TSS 360, TOC 300).
  residential: { tknPerCod: 0.0778, tpPerCod: 0.0167, tssPerCod: 0.4, tocPerCod: 0.333, bodPerCod: 0.45, fogPerCod: 0.011, fsaPerTkn: 0.75, opPerTp: 0.6, alkalinityMgL: 220 },
  commercial: { tknPerCod: 0.06, tpPerCod: 0.013, tssPerCod: 0.45, tocPerCod: 0.33, bodPerCod: 0.45, fogPerCod: 0.02, fsaPerTkn: 0.7, opPerTp: 0.6, alkalinityMgL: 200 },
  shopping_centre: { tknPerCod: 0.05, tpPerCod: 0.012, tssPerCod: 0.45, tocPerCod: 0.33, bodPerCod: 0.5, fogPerCod: 0.04, fsaPerTkn: 0.65, opPerTp: 0.55, alkalinityMgL: 180 },
  hospital: { tknPerCod: 0.08, tpPerCod: 0.018, tssPerCod: 0.4, tocPerCod: 0.33, bodPerCod: 0.45, fogPerCod: 0.015, fsaPerTkn: 0.75, opPerTp: 0.6, alkalinityMgL: 220 },
  industrial: { tknPerCod: 0.04, tpPerCod: 0.01, tssPerCod: 0.5, tocPerCod: 0.35, bodPerCod: 0.45, fogPerCod: 0.03, fsaPerTkn: 0.65, opPerTp: 0.55, alkalinityMgL: 150 },
};

interface MembraneSpec {
  label: string;
  fluxLmh: number;
  /** Nm³/hr air scour per m² coefficient: scour = coeff × area / 1000 × 60. */
  scourCoeff: number;
  /** Nominal SMU module membrane area, m² (flagged assumption for module count). */
  nominalModuleAreaM2: number;
}

const MEMBRANES: Record<MembraneModel, MembraneSpec> = {
  megavision: { label: 'Megavision hollow fibre', fluxLmh: 18.4, scourCoeff: 15, nominalModuleAreaM2: 200 },
  memstar: { label: 'Memstar hollow fibre', fluxLmh: 20, scourCoeff: 9, nominalModuleAreaM2: 200 },
};

// ---- helpers ----
const round = (x: number, dp = 3): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const ceil = Math.ceil;
/** DO saturation (mg/L) at sea level (APHA polynomial). */
function doSat(tC: number): number {
  return 14.652 - 0.41022 * tC + 0.0079910 * tC * tC - 0.000077774 * tC * tC * tC;
}
/** Standard-atmosphere site pressure (kPa) from elevation (m). */
function sitePressureKpa(elevationM: number): number {
  return (101325 * (1 - 2.25577e-5 * elevationM) ** 5.25588) / 1000;
}
/** SOTE (%) interpolated from diffuser depth — xlsm sheet 6 estimate column. */
function interpSote(depthM: number): number {
  const table: Array<[number, number]> = [
    [2, 11.5], [2.5, 15.8], [3, 19.5], [3.3, 21.3], [4, 25.2], [5, 30], [6, 34],
  ];
  if (depthM <= table[0]![0]) return table[0]![1];
  if (depthM >= table[table.length - 1]![0]) return table[table.length - 1]![1];
  for (let i = 1; i < table.length; i++) {
    const [d1, s1] = table[i]!;
    const [d0, s0] = table[i - 1]!;
    if (depthM <= d1) return s0 + ((depthM - d0) / (d1 - d0)) * (s1 - s0);
  }
  return table[table.length - 1]![1];
}

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
  TKN: number; FSA: number; TP: number; OP: number; TSS: number; FOG: number; alkalinity: number; pH: number;
}
export interface CodFractionation { USO: number; BSO: number; UPO: number; BPO: number; totalBiodegradable: number; totalUnbiodegradable: number; fSbs: number; }
export interface FlowSet { adwf: number; awwf: number; pdwf: number; pwwf: number; }
export interface TankOption { label: string; lengthM: number; widthM: number; depthM: number; volumeM3: number; }
export interface SizedTank { name: string; volumeM3: number; options: [TankOption, TankOption]; }

export interface MleMbrDesign {
  basis: MleMbrBasis;
  constants: MleMbrConstants;
  process: { config: ProcessConfig; minSludgeAgeDays: number; sludgeAgeDays: number; mlssMgL: number; trains: number; recycle: { a: number; s: number; r: number } };
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
  effluent: { ammoniaMgL: number; nitrateMgL: number; tknMgL: number; nitrogenRemovalPct: number; effluentAlkalinityMgL: number };
  aeration: {
    o2OhoKgD: number; o2NitrificationKgD: number; o2DenitCreditKgD: number; o2ScourCreditKgD: number; o2TotalKgD: number;
    soteFraction: number; oteFraction: number;
    processAirNm3h: number; processAirAm3h: number; diffuserCount: number; blowerKW: number;
  };
  mbr: {
    included: boolean; model: string; fluxLmh: number; membraneAreaM2: number; moduleCount: number; moduleAreaM2: number;
    permeateDutyM3h: number; airScourNm3h: number; airScourAm3h: number; scourBlowerKW: number;
  };
  tanks: SizedTank[];
  solids: { wasM3d: number; wasTssMgL: number; wasVssMgL: number; thickening: string; dewatering: string };
  utilities: { installedKW: number; dutyKW: number; energyKwhPerM3: number; naoclLPerDay: number; cipAcidLPerDay: number; serviceWaterM3d: number };
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
  const flows: FlowSet = { adwf: round(Q, 1), awwf: round(awwf, 1), pdwf: round(pdwf, 1), pwwf: round(pwwf, 1) };
  records.push(rec('Average wet-weather flow', 'AWWF', 'AWWF = ADWF × awwfFactor', { ADWF: { value: Q, unit: 'm3/d', source: 'user input' } }, awwf, 'm3/d'));
  records.push(rec('Peak wet-weather flow', 'PWWF', 'PWWF = AWWF × PF', { AWWF: { value: awwf, unit: 'm3/d', source: 'computed' }, PF: { value: k.peakFactor, unit: '', source: 'default' } }, pwwf, 'm3/d'));

  // ---- [0/1] Derived influent + COD fractionation ----
  const r = LAND_USE_RATIOS[basis.landUse];
  const COD = basis.codMgL;
  const TKN = COD * r.tknPerCod;
  const TP = COD * r.tpPerCod;
  const influent: DerivedInfluent = {
    COD, CODfiltered: COD * k.codFilteredFraction, BOD: COD * r.bodPerCod, TOC: COD * r.tocPerCod,
    TKN, FSA: TKN * r.fsaPerTkn, TP, OP: TP * r.opPerTp, TSS: COD * r.tssPerCod, FOG: COD * r.fogPerCod,
    alkalinity: r.alkalinityMgL, pH: 7.5,
  };
  const soluble = influent.CODfiltered;
  const USO = k.fSus * COD;
  const BSO = soluble - USO;
  const UPO = k.fSup * COD;
  const particulate = COD - soluble;
  const BPO = particulate - UPO;
  const totalBiodeg = BSO + BPO;
  const totalUnbiodeg = USO + UPO;
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
  const muAmT = k.muAm20 * 1.123 ** (T - 20);
  const KnT = k.Kn20 * 1.123 ** (T - 20);
  const bAT = k.bA20 * 1.029 ** (T - 20);
  const Yhv = k.YH / k.fcv;
  const bHTmin = 0.24 * 1.029 ** (T - 20);
  const C28 = (Yhv * Rs) / (1 + Rs * bHTmin); // (YH·Rs)/(1+bhT·Rs)

  // ---- [4] Sludge masses ----
  const FSi = (COD * Q) / 1000;
  const FSbi = (totalBiodeg * Q) / 1000;
  const FXii = (influent.TSS * 0.2 * Q) / 1000;
  const Mbh = FSbi * C28;
  const Mxeh = k.fH * bHTmin * Rs * Mbh;
  const MXI = ((k.fSup * FSi) / k.fcv) * Rs;
  const MXv = MXI + Mxeh + Mbh;
  const MXIO = FXii * Rs + k.fiOHO * Mbh;
  const MXt = MXIO + MXv;
  records.push(rec('Biomass in reactor', 'Mbh', 'Mbh = FSbi × (YH·Rs)/(1+bhT·Rs)', { FSbi: { value: FSbi, unit: 'kgCOD/d', source: 'computed' }, factor: { value: C28, unit: '', source: 'kinetics' } }, Mbh, 'kgVSS'));
  records.push(rec('Total TSS in reactor', 'MXt', 'MXt = MXIO + MXv', { MXIO: { value: MXIO, unit: 'kgISS', source: 'computed' }, MXv: { value: MXv, unit: 'kgVSS', source: 'computed' } }, MXt, 'kgTSS'));

  // ---- [4/5] Reactor volume + sizing ----
  const Vmin = (MXt / k.mlssMgL) * 1000;
  const hrtTotal = (Vmin / Q) * 24;
  const Qw = Vmin / Rs;
  const FXw = (Qw * k.mlssMgL) / 1000;
  const Vt = Vmin * k.volumeSafetyFactor;
  const fxt = config === 'aerobic' ? 0 : k.anoxicMassFraction;
  const fan = config === 'A2O_UCT' ? 0.1 : 0; // simple anaerobic fraction for EBPR
  const Va = Vt * (1 - fxt - fan);
  const Vax = Vt * fxt;
  const Van = Vt * fan;
  records.push(rec('Total reactor volume (min)', 'Vmin', 'Vmin = MXt / MLSS × 1000', { MXt: { value: MXt, unit: 'kgTSS', source: 'computed' }, MLSS: { value: k.mlssMgL, unit: 'mg/L', source: 'default' } }, Vmin, 'm3'));
  records.push(rec('Total reactor volume (selected)', 'Vt', 'Vt = Vmin × safety', { Vmin: { value: Vmin, unit: 'm3', source: 'computed' }, safety: { value: k.volumeSafetyFactor, unit: '', source: 'default' } }, Vt, 'm3'));
  records.push(rec('Sludge waste rate', 'Qw', 'Qw = Vmin / Rs', { Vmin: { value: Vmin, unit: 'm3', source: 'computed' }, Rs: { value: Rs, unit: 'd', source: 'default' } }, Qw, 'm3/d'));

  // ---- [4] Nitrogen balance ----
  const Ns = (k.fnUPO * MXv) / (Q * Rs) * 1000;
  const bRecip = bAT + 1 / Rs;
  const Nae = (KnT * bRecip) / (muAmT * (1 - fxt) - bRecip);
  const USOrgN = 2; // typical unbiodegradable soluble organic N (xlsm Nousi)
  const TKNe = Math.max(Nae, 0) + USOrgN;
  const Nc = basis.nitrogenRemoval ? Math.max(0, influent.TKN - Ns - TKNe) : 0;
  const Nne = config === 'aerobic' ? Nc : Nc / (k.aRecycle + k.sRecycle + 1);
  const nRemovalPct = basis.nitrogenRemoval ? ((influent.TKN - (USOrgN + Nne + Nae)) / influent.TKN) * 100 : 0;
  const alkConsumed = 7.14 * Nc;
  const alkRecovered = 3.57 * (Nc - Nne);
  const effAlk = influent.alkalinity - alkConsumed + alkRecovered + 32;
  if (effAlk < 40) warnings.push(`Effluent alkalinity ${round(effAlk, 0)} mg/L < 40 — lime dosing may be required to prevent bulking.`);
  records.push(rec('Effluent ammonia', 'Nae', 'Nae = KnT(bAT+1/Rs) / (μAmT(1-fxt) - (bAT+1/Rs))', { KnT: { value: KnT, unit: 'mgN/L', source: 'kinetics' }, muAmT: { value: muAmT, unit: '1/d', source: 'kinetics' } }, Nae, 'mgN/L'));
  records.push(rec('Effluent nitrate', 'Nne', 'Nne = Nc / (a+s+1)', { Nc: { value: Nc, unit: 'mgN/L', source: 'computed' }, a: { value: k.aRecycle, unit: '', source: 'default' } }, Nne, 'mgNO3/L'));

  // ---- [7] MBR (before aeration: scour O2 credits aeration) ----
  const m = MEMBRANES[basis.membraneModel];
  const flowToTreat = (awwf * k.mbrMembranePeakFactor) / k.mbrOpDurationH; // m³/hr
  const membraneAreaReq = (flowToTreat * 1000) / m.fluxLmh; // m²
  const moduleCount = basis.mbrRequired ? Math.max(1, ceil(membraneAreaReq / m.nominalModuleAreaM2)) : 0;
  const moduleArea = moduleCount > 0 ? membraneAreaReq / moduleCount : 0;
  const Ps = 101.33;
  const Pb = sitePressureKpa(basis.elevationM);
  const am3hFactor = (Ps / Pb) * ((273 + 25) / 273);
  const scourNm3h = basis.mbrRequired
    ? (basis.membraneModel === 'megavision' ? (m.scourCoeff * membraneAreaReq) / 1000 * 60 : m.scourCoeff * moduleCount)
    : 0;
  const scourAm3h = scourNm3h * am3hFactor;
  const scourTransferEff = (0.5 * k.diffuserDepthM) / 100;
  const scourO2KgD = scourNm3h * scourTransferEff * 0.21 * 1.421 * 24;
  records.push(rec('MBR membrane area required', 'Am', 'Am = (flowToTreat × 1000) / flux', { flowToTreat: { value: flowToTreat, unit: 'm3/hr', source: 'AWWF×1.5/opDuration' }, flux: { value: m.fluxLmh, unit: 'LMH', source: 'membrane' } }, membraneAreaReq, 'm2'));
  records.push(rec('MBR air scour', 'Qscour', basis.membraneModel === 'megavision' ? 'Qscour = 15 × area/1000 × 60' : 'Qscour = 9 × modules', { area: { value: membraneAreaReq, unit: 'm2', source: 'computed' } }, scourNm3h, 'Nm3/hr'));

  // ---- [6] Aeration ----
  const FOc = FSbi * ((1 - k.fcv * Yhv) + (k.fcv * (1 - k.fH) * bHTmin * Yhv * Rs) / (1 + bHTmin * Rs));
  const FOn = Math.max(0, (4.57 * Q * Nc) / 1000);
  const FOdn = Math.max(0, (2.86 * (Nc - Nne) * Q) / 1000);
  const FOt = FOc + FOn - FOdn;
  const sote = interpSote(k.diffuserDepthM) / 100;
  const alphaT = k.alpha * 1.024 ** (T - 20);
  const omega = Pb / Ps;
  const cs20 = doSat(20) * omega;
  const csInf = cs20 * (1 + 0.4 * (k.diffuserDepthM / 10.33));
  const tau = doSat(T) / doSat(20);
  const oteOverSote = ((tau * k.beta * omega * csInf - k.minDOmgL) / csInf) * 1.024 ** (T - 20) * (alphaT * k.foulingFactor);
  const ote = oteOverSote * sote;
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
  const cipAcidLPerDay = round(membraneAreaReq * 0.002, 2); // citric/HCl CIP estimate
  const serviceWaterM3d = round(Q * 0.02, 2);

  if (k.mlssMgL > 12000) warnings.push(`MLSS ${k.mlssMgL} mg/L above the typical MBR ceiling (8000–12000).`);
  if (config === 'A2O_UCT') warnings.push('P-removal selected: anaerobic zone added (UCT) — EBPR sizing is simplified; confirm at detailed design.');

  return {
    basis,
    constants: k,
    process: { config, minSludgeAgeDays: round((1 + fxt) / (muAmT - bAT), 1), sludgeAgeDays: Rs, mlssMgL: k.mlssMgL, trains: 1, recycle: { a: k.aRecycle, s: k.sRecycle, r: k.rRecycle } },
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
    effluent: { ammoniaMgL: round(Math.max(0, Nae), 2), nitrateMgL: round(Nne, 2), tknMgL: round(TKNe, 2), nitrogenRemovalPct: round(nRemovalPct, 1), effluentAlkalinityMgL: round(effAlk, 0) },
    aeration: {
      o2OhoKgD: round(FOc, 2), o2NitrificationKgD: round(FOn, 2), o2DenitCreditKgD: round(FOdn, 2), o2ScourCreditKgD: round(scourO2KgD, 2), o2TotalKgD: round(FOt, 2),
      soteFraction: round(sote, 4), oteFraction: round(ote, 5),
      processAirNm3h: round(processAirNm3h, 1), processAirAm3h: round(processAirAm3h, 1), diffuserCount, blowerKW: round(blowerKW, 2),
    },
    mbr: {
      included: basis.mbrRequired, model: m.label, fluxLmh: m.fluxLmh, membraneAreaM2: round(membraneAreaReq, 0), moduleCount, moduleAreaM2: round(moduleArea, 0),
      permeateDutyM3h: round(flowToTreat, 2), airScourNm3h: round(scourNm3h, 1), airScourAm3h: round(scourAm3h, 1), scourBlowerKW: round(scourBlowerKW, 2),
    },
    tanks,
    solids: { wasM3d: round(Qw, 2), wasTssMgL: k.mlssMgL, wasVssMgL: round(k.mlssMgL * 0.72, 0), thickening: 'Gravity thickener / picket-fence', dewatering: 'Belt press or screw press' },
    utilities: { installedKW: round(installedKW, 1), dutyKW: round(dutyKW, 1), energyKwhPerM3: round(energyKwhPerM3, 2), naoclLPerDay: round(naoclLPerDay, 2), cipAcidLPerDay, serviceWaterM3d },
    calculationRecords: records,
    warnings,
  };
}
