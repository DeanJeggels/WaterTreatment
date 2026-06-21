/**
 * Denitrification kernels — the Marais-Ekama steady-state denitrification model
 * from WWTP Design.xlsm sheet 3 (denitrification kinetics) and sheet 4
 * (denitrification potential Dp1). Pure functions, constants passed in
 * explicitly. Reconciled to the workbook's cached values (see
 * denitrification-kernel.test.ts).
 *
 * The two anoxic specific denitrification rates K1 (primary/initial, rapid
 * utilisation of readily-biodegradable COD) and K2 (secondary, slow utilisation
 * of slowly-biodegradable COD) are Arrhenius-corrected with their workbook theta
 * values (K1 theta 1.2, K2 theta 1.08). Dp1 is the first-anoxic-reactor
 * denitrification potential per sheet 4 cell C55.
 */
import { arrhenius } from './wastewater';

/** Default primary denitrification rate @20°C (K1,20), mgNO3-N/mgVSS.d (sheet 3). */
export const K1_20_DEFAULT = 0.72;
/** Arrhenius theta for the primary denitrification rate K1 (sheet 3). */
export const K1_THETA = 1.2;
/** Default secondary denitrification rate @20°C (K2,20), mgNO3-N/mgVSS.d (sheet 3). */
export const K2_20_DEFAULT = 0.101;
/** Arrhenius theta for the secondary denitrification rate K2 (sheet 3). */
export const K2_THETA = 1.08;
/** Stoichiometric COD equivalent of nitrate reduction (mgO2/mgNO3-N). */
export const COD_PER_NO3N = 2.86;

/**
 * Primary (initial) anoxic specific denitrification rate at temperature T:
 *   K1,T = K1,20 × 1.2^(T−20).
 * Default K1,20 = 0.72 mgNO3-N/mgVSS.d (sheet 3).
 */
export function denitrificationRateK1(tempC: number, K1_20: number = K1_20_DEFAULT): number {
  return arrhenius(K1_20, K1_THETA, tempC);
}

/**
 * Secondary (slow) anoxic specific denitrification rate at temperature T:
 *   K2,T = K2,20 × 1.08^(T−20).
 * Default K2,20 = 0.101 mgNO3-N/mgVSS.d (sheet 3 C17).
 */
export function denitrificationRateK2(tempC: number, K2_20: number = K2_20_DEFAULT): number {
  return arrhenius(K2_20, K2_THETA, tempC);
}

/** Stoichiometric/yield constant for the denitrification potential (sheet 4). */
export interface DenitPotentialConstants {
  /** COD/VSS ratio (fcv), mgCOD/mgVSS. */
  fcv: number;
}

/** Kinetics needed by the denitrification potential (subset of the AS Kinetics). */
export interface DenitKinetics {
  /** Specific heterotroph yield (Yhv = YH/fcv), mgVSS/mgCOD. */
  Yhv: number;
  /** Heterotroph endogenous rate @T (bHT), 1/d. */
  bHT: number;
}

/** Inputs describing the influent and the first-anoxic mass split. */
export interface DenitPotentialInputs {
  /** Total biodegradable COD concentration (CODbi = Sbi), mg/L. */
  CODbi: number;
  /** Readily-biodegradable fraction of biodegradable COD (fSb's). */
  fSbs: number;
  /** Anoxic mass fraction of the first anoxic reactor (fxt). */
  fxt: number;
  /** Sludge age / SRT (Rs), days. */
  srtDays: number;
}

/**
 * First-anoxic-reactor denitrification potential Dp1 (mgNO3-N/L), sheet 4 C55:
 *
 *   Dp1 = CODbi × ( fSbs·(1 − fcv·Yhv)/2.86
 *                  + K2T·fxt·Yhv·Rs / (1 + bHT·Rs) )
 *
 * The first term is the nitrate equivalent of the readily-biodegradable COD
 * utilised in the anoxic zone; the second is the slow (K2-rate) utilisation of
 * slowly-biodegradable COD over the anoxic sludge mass.
 */
export function denitrificationPotential(
  inp: DenitPotentialInputs,
  kin: DenitKinetics,
  K2T: number,
  c: DenitPotentialConstants,
): number {
  const rbcodTerm = (inp.fSbs * (1 - c.fcv * kin.Yhv)) / COD_PER_NO3N;
  const slowTerm = (K2T * inp.fxt * kin.Yhv * inp.srtDays) / (1 + kin.bHT * inp.srtDays);
  return inp.CODbi * (rbcodTerm + slowTerm);
}

/**
 * Nitrate actually denitrified given the influent nitrate load to the anoxic
 * zone and the available denitrification potential Dp (both mgNO3-N/L). The
 * removal is capacity-limited: you cannot remove more nitrate than is present,
 * nor more than the potential allows, and never negative.
 */
export function denitrifiedNitrate(no3In: number, Dp: number): number {
  return Math.max(0, Math.min(no3In, Dp));
}
