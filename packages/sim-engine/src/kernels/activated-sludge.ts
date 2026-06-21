/**
 * Activated-sludge kernels — the Marais-Ekama steady-state reactor model from
 * WWTP Design.xlsm sheets 3–5. Pure functions, constants passed in explicitly.
 *
 * These compute reactor-LEVEL quantities (sludge inventory at an SRT, reactor
 * volume from MLSS, nitrification capacity, effluent N), which are inherently
 * coupled across the biological reactor — the graph solver applies them to the
 * recognised reactor group, not edge-by-edge.
 */
import { arrhenius } from './wastewater';

export type ProcessConfig = 'MLE' | 'A2O_UCT' | 'aerobic';

export interface KineticConstants {
  /** Max specific growth rate of nitrifiers @20°C (µAm20), 1/d. */
  muAm20: number;
  /** Half-saturation constant for nitrifiers @20°C (Kn20), mgN/L. */
  Kn20: number;
  /** Endogenous respiration rate of nitrifiers @20°C (bA20), 1/d. */
  bA20: number;
  /** Heterotroph yield (YH), mgCOD/mgCOD. */
  YH: number;
  /** COD/VSS ratio (fcv), mgCOD/mgVSS. */
  fcv: number;
  /** Heterotroph endogenous respiration rate @20°C (bH20), 1/d. */
  bH20: number;
}

export interface Kinetics {
  /** Max nitrifier growth rate @T (µAmT), 1/d. */
  muAmT: number;
  /** Nitrifier half-saturation @T (KnT), mgN/L. */
  KnT: number;
  /** Nitrifier endogenous rate @T (bAT), 1/d. */
  bAT: number;
  /** Specific heterotroph yield (Yhv = YH/fcv), mgVSS/mgCOD. */
  Yhv: number;
  /** Heterotroph endogenous rate @T (bHT), 1/d. */
  bHT: number;
  /** (YH·Rs)/(1+bhT·Rs) — biomass accumulation factor (sheet 3 C28). */
  C28: number;
}

/** Temperature- and SRT-corrected kinetics (sheet 3). */
export function kineticsAtT(k: KineticConstants, tempC: number, srtDays: number): Kinetics {
  const muAmT = arrhenius(k.muAm20, 1.123, tempC);
  const KnT = arrhenius(k.Kn20, 1.123, tempC);
  const bAT = arrhenius(k.bA20, 1.029, tempC);
  const Yhv = k.YH / k.fcv;
  const bHT = arrhenius(k.bH20, 1.029, tempC);
  const C28 = (Yhv * srtDays) / (1 + srtDays * bHT);
  return { muAmT, KnT, bAT, Yhv, bHT, C28 };
}

export interface SludgeMassConstants {
  /** Unbiodegradable particulate COD fraction (fS'up). */
  fSup: number;
  /** COD/VSS ratio (fcv). */
  fcv: number;
  /** Endogenous residue fraction (fH). */
  fH: number;
  /** ISS content of OHOs (fiOHO). */
  fiOHO: number;
}

export interface SludgeMasses {
  /** Flux of total influent COD (FSi), kgCOD/d. */
  FSi: number;
  /** Flux of total biodegradable COD (FSbi), kgCOD/d. */
  FSbi: number;
  /** Flux of influent unbiodegradable particulate ISS (FXii), kgISS/d. */
  FXii: number;
  /** Active heterotroph biomass (Mbh), kgVSS. */
  Mbh: number;
  /** Endogenous residue (Mxeh), kgVSS. */
  Mxeh: number;
  /** Unbiodegradable particulates (MXI), kgVSS. */
  MXI: number;
  /** Total volatile suspended solids in reactor (MXv), kgVSS. */
  MXv: number;
  /** Total inorganic suspended solids (MXIO), kgISS. */
  MXIO: number;
  /** Total suspended solids in reactor (MXt), kgTSS. */
  MXt: number;
}

export interface InfluentLoad {
  /** Total influent COD, mg/L. */
  COD: number;
  /** Total biodegradable COD (from fractionateCod), mg/L. */
  totalBiodegradable: number;
  /** Influent ISS load, mg/L (TSS × issPerTss, or measured ISS). */
  ISS: number;
  /** Flow to reactor, m³/d. */
  flow: number;
}

/** Reactor sludge inventory at a given SRT (sheet 4). */
export function sludgeMasses(
  c: SludgeMassConstants,
  load: InfluentLoad,
  srtDays: number,
  kin: Pick<Kinetics, 'C28' | 'bHT'>,
): SludgeMasses {
  const FSi = (load.COD * load.flow) / 1000;
  const FSbi = (load.totalBiodegradable * load.flow) / 1000;
  const FXii = (load.ISS * load.flow) / 1000;
  const Mbh = FSbi * kin.C28;
  const Mxeh = c.fH * kin.bHT * srtDays * Mbh;
  const MXI = ((c.fSup * FSi) / c.fcv) * srtDays;
  const MXv = MXI + Mxeh + Mbh;
  const MXIO = FXii * srtDays + c.fiOHO * Mbh;
  const MXt = MXIO + MXv;
  return { FSi, FSbi, FXii, Mbh, Mxeh, MXI, MXv, MXIO, MXt };
}

export interface ReactorSizingConstants {
  /** Mixed-liquor suspended solids target, mg/L. */
  mlssMgL: number;
  /** Volume safety factor (on top of the AWWF factor). */
  volumeSafetyFactor: number;
  /** Selected anoxic mass fraction (fxt). */
  anoxicMassFraction: number;
  /** Anaerobic mass fraction for EBPR (UCT only). */
  anaerobicMassFraction?: number;
}

export interface ReactorSizing {
  /** Minimum reactor volume from sludge inventory, m³. */
  volumeMinM3: number;
  /** Selected reactor volume (× safety factor), m³. */
  volumeSelectedM3: number;
  /** Total hydraulic retention time, h. */
  hrtTotalH: number;
  /** Sludge waste rate, m³/d. */
  wasM3d: number;
  /** Sludge waste mass rate, kgTSS/d. */
  wasKgTssD: number;
  /** Selected anoxic mass fraction used. */
  fxt: number;
  /** Anaerobic mass fraction used. */
  fan: number;
  /** Aerobic volume, m³. */
  aerobicVolumeM3: number;
  /** Anoxic volume, m³. */
  anoxicVolumeM3: number;
  /** Anaerobic volume, m³. */
  anaerobicVolumeM3: number;
}

/** Reactor volume from MLSS and its zone split (sheets 4–5). */
export function reactorSizing(
  c: ReactorSizingConstants,
  masses: Pick<SludgeMasses, 'MXt'>,
  flow: number,
  srtDays: number,
  config: ProcessConfig,
): ReactorSizing {
  const volumeMinM3 = (masses.MXt / c.mlssMgL) * 1000;
  const hrtTotalH = (volumeMinM3 / flow) * 24;
  const wasM3d = volumeMinM3 / srtDays;
  const wasKgTssD = (wasM3d * c.mlssMgL) / 1000;
  const volumeSelectedM3 = volumeMinM3 * c.volumeSafetyFactor;
  const fxt = config === 'aerobic' ? 0 : c.anoxicMassFraction;
  const fan = config === 'A2O_UCT' ? (c.anaerobicMassFraction ?? 0.1) : 0;
  return {
    volumeMinM3, volumeSelectedM3, hrtTotalH, wasM3d, wasKgTssD, fxt, fan,
    aerobicVolumeM3: volumeSelectedM3 * (1 - fxt - fan),
    anoxicVolumeM3: volumeSelectedM3 * fxt,
    anaerobicVolumeM3: volumeSelectedM3 * fan,
  };
}

export interface NitrogenConstants {
  /** N content of VSS for UPO (fnUPO), mgN/mgVSS. */
  fnUPO: number;
  /** Influent alkalinity, mg/L as CaCO3. */
  alkalinityMgL: number;
  /** a-recycle ratio (IMLR). */
  aRecycle: number;
  /** s-recycle ratio (RAS). */
  sRecycle: number;
  /** Unbiodegradable soluble organic N (Nousi), mgN/L. */
  usOrgN?: number;
}

export interface NitrogenBalance {
  /** N removed in waste sludge (Ns), mgN/L. */
  Ns: number;
  /** Effluent ammonia (Nae), mgN/L. */
  ammoniaMgL: number;
  /** Effluent TKN (TKNe), mgN/L. */
  tknMgL: number;
  /** Nitrification capacity (Nc), mgN/L. */
  nitrificationCapacity: number;
  /** Effluent nitrate (Nne), mgNO3-N/L. */
  nitrateMgL: number;
  /** Alkalinity consumed by nitrification, mg/L as CaCO3. */
  alkConsumed: number;
  /** Alkalinity recovered by denitrification, mg/L as CaCO3. */
  alkRecovered: number;
  /** Effluent alkalinity, mg/L as CaCO3. */
  effluentAlkalinityMgL: number;
}

export interface NitrogenInputs {
  /** Influent TKN, mgN/L. */
  TKN: number;
  /** Total VSS in reactor (MXv), kgVSS. */
  MXv: number;
  /** Flow, m³/d. */
  flow: number;
  /** SRT, d. */
  srtDays: number;
  config: ProcessConfig;
  nitrogenRemoval: boolean;
}

/** Steady-state nitrogen balance & effluent N (sheet 4). */
export function nitrogenBalance(
  c: NitrogenConstants,
  inp: NitrogenInputs,
  kin: Pick<Kinetics, 'muAmT' | 'KnT' | 'bAT'>,
  fxt: number,
): NitrogenBalance {
  const Ns = ((c.fnUPO * inp.MXv) / (inp.flow * inp.srtDays)) * 1000;
  const bRecip = kin.bAT + 1 / inp.srtDays;
  const ammoniaMgL = (kin.KnT * bRecip) / (kin.muAmT * (1 - fxt) - bRecip);
  const usOrgN = c.usOrgN ?? 2;
  const tknMgL = Math.max(ammoniaMgL, 0) + usOrgN;
  const nitrificationCapacity = inp.nitrogenRemoval ? Math.max(0, inp.TKN - Ns - tknMgL) : 0;
  const nitrateMgL = inp.config === 'aerobic'
    ? nitrificationCapacity
    : nitrificationCapacity / (c.aRecycle + c.sRecycle + 1);
  const alkConsumed = 7.14 * nitrificationCapacity;
  const alkRecovered = 3.57 * (nitrificationCapacity - nitrateMgL);
  const effluentAlkalinityMgL = c.alkalinityMgL - alkConsumed + alkRecovered + 32;
  return {
    Ns, ammoniaMgL, tknMgL, nitrificationCapacity, nitrateMgL,
    alkConsumed, alkRecovered, effluentAlkalinityMgL,
  };
}
