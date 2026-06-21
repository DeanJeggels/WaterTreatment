/**
 * Wastewater-characterisation kernels — pure functions extracted from the
 * WWTP Design.xlsm (Marais-Ekama / WRC TT-16/84) workbook so the MLE-MBR design
 * generator AND the flowsheet block models compute from ONE source of truth.
 *
 * Every kernel is pure (no clocks, no randomness) and takes its constants
 * explicitly — no process magic numbers are hidden inside. Reconciled to the
 * workbook's cached values (see kernels.test.ts).
 */

/** DO surface saturation (mg/L) at sea level — APHA polynomial (sheet 6). */
export function doSaturation(tempC: number): number {
  return 14.652 - 0.41022 * tempC + 0.0079910 * tempC * tempC - 0.000077774 * tempC * tempC * tempC;
}

/** Standard-atmosphere site pressure (kPa) from elevation (m) — sheet 6 C23. */
export function sitePressureKpa(elevationM: number): number {
  return (101325 * (1 - 2.25577e-5 * elevationM) ** 5.25588) / 1000;
}

/**
 * Arrhenius temperature correction: rate(T) = rate20 × theta^(T−20).
 * theta values per the workbook (sheet 3): nitrifier growth/half-sat 1.123,
 * endogenous 1.029, denitrification K1 1.2 / K2 1.08, aeration alpha 1.024.
 */
export function arrhenius(rate20: number, theta: number, tempC: number): number {
  return rate20 * theta ** (tempC - 20);
}

export interface CodFractions {
  /** Unbiodegradable particulate COD fraction of total COD (fS'up). */
  fSup: number;
  /** Unbiodegradable soluble COD fraction of total COD (fS'us). */
  fSus: number;
  /** Soluble (0.45 µm filtered) COD as a fraction of total COD. */
  codFilteredFraction: number;
}

export interface CodFractionationResult {
  /** Unbiodegradable soluble organics (Susi), mg/L. */
  USO: number;
  /** Biodegradable soluble organics (Sbsi), mg/L. */
  BSO: number;
  /** Unbiodegradable particulate organics (Supi), mg/L. */
  UPO: number;
  /** Biodegradable particulate organics (Sbpi), mg/L. */
  BPO: number;
  /** Total biodegradable COD (Sbi), mg/L. */
  totalBiodegradable: number;
  /** Total unbiodegradable COD, mg/L. */
  totalUnbiodegradable: number;
  /** Readily-biodegradable fraction of biodegradable COD (fSb's). */
  fSbs: number;
  /** Soluble COD (0.45 µm filtered), mg/L. */
  soluble: number;
}

/**
 * Split total influent COD into its biodegradable/unbiodegradable,
 * soluble/particulate fractions (sheet 1, "COD FRACTIONS" + nutrient
 * fractionation). This is the canonical fractionation used by the bioreactor.
 */
export function fractionateCod(totalCod: number, f: CodFractions): CodFractionationResult {
  const soluble = totalCod * f.codFilteredFraction;
  const USO = f.fSus * totalCod;
  const BSO = soluble - USO;
  const UPO = f.fSup * totalCod;
  const particulate = totalCod - soluble;
  const BPO = particulate - UPO;
  const totalBiodegradable = BSO + BPO;
  const totalUnbiodegradable = USO + UPO;
  return {
    USO, BSO, UPO, BPO,
    totalBiodegradable, totalUnbiodegradable,
    fSbs: totalBiodegradable > 0 ? BSO / totalBiodegradable : 0,
    soluble,
  };
}

export interface InfluentRatios {
  tknPerCod: number;
  tpPerCod: number;
  tssPerCod: number;
  codFilteredFraction: number;
  bodPerCod: number;
  tocPerCod: number;
  fogPerCod: number;
  fsaPerTkn: number;
  opPerTp: number;
  issPerTss: number;
  alkalinityMgL: number;
}

export interface InfluentProfile {
  COD: number; CODfiltered: number; BOD: number; TOC: number;
  TKN: number; FSA: number; TP: number; OP: number;
  TSS: number; ISS: number; FOG: number; alkalinity: number; pH: number;
}

/**
 * Derive a full influent characterisation from a single total COD plus the
 * land-use estimation ratios (sheet 0/1). Used when only COD is known.
 */
export function deriveInfluent(totalCod: number, r: InfluentRatios, pH = 7.5): InfluentProfile {
  const TKN = totalCod * r.tknPerCod;
  const TP = totalCod * r.tpPerCod;
  const TSS = totalCod * r.tssPerCod;
  return {
    COD: totalCod,
    CODfiltered: totalCod * r.codFilteredFraction,
    BOD: totalCod * r.bodPerCod,
    TOC: totalCod * r.tocPerCod,
    TKN, FSA: TKN * r.fsaPerTkn,
    TP, OP: TP * r.opPerTp,
    TSS, ISS: TSS * r.issPerTss,
    FOG: totalCod * r.fogPerCod,
    alkalinity: r.alkalinityMgL,
    pH,
  };
}
