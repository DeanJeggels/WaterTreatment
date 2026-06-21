/**
 * Aeration kernels — oxygen demand and air-transfer efficiency from
 * WWTP Design.xlsm sheet 6. Pure functions, constants passed in explicitly.
 */
import { arrhenius, doSaturation, sitePressureKpa } from './wastewater';
import type { Kinetics } from './activated-sludge';

const O2_FRACTION_OF_AIR = 0.21;
const AIR_DENSITY_FACTOR = 1.421; // kg O₂ per Nm³ at the workbook's reference
const STD_PRESSURE_KPA = 101.33;

export interface OxygenDemand {
  /** O₂ for carbonaceous (heterotroph) oxidation (FOc), kgO/d. */
  carbonaceousKgD: number;
  /** O₂ for nitrification (FOn), kgO/d. */
  nitrificationKgD: number;
  /** O₂ recovered by denitrification (FOdn), kgO/d. */
  denitrificationCreditKgD: number;
  /** Net total O₂ demand (FOt = FOc + FOn − FOdn), kgO/d. */
  totalKgD: number;
}

export interface OxygenDemandConstants {
  fcv: number;
  fH: number;
}

export interface OxygenDemandInputs {
  /** Flux of total biodegradable COD (FSbi), kgCOD/d. */
  FSbi: number;
  /** Flow, m³/d. */
  flow: number;
  /** Nitrification capacity (Nc), mgN/L. */
  nitrificationCapacity: number;
  /** Effluent nitrate (Nne), mgNO3-N/L. */
  nitrateMgL: number;
  /** SRT, d. */
  srtDays: number;
}

/** Total process oxygen demand (sheet 6 FOc/FOn/FOdn/FOt). */
export function oxygenDemand(
  c: OxygenDemandConstants,
  inp: OxygenDemandInputs,
  kin: Pick<Kinetics, 'Yhv' | 'bHT'>,
): OxygenDemand {
  const carbonaceousKgD = inp.FSbi * (
    (1 - c.fcv * kin.Yhv) +
    (c.fcv * (1 - c.fH) * kin.bHT * kin.Yhv * inp.srtDays) / (1 + kin.bHT * inp.srtDays)
  );
  const nitrificationKgD = Math.max(0, (4.57 * inp.flow * inp.nitrificationCapacity) / 1000);
  const denitrificationCreditKgD = Math.max(
    0,
    (2.86 * (inp.nitrificationCapacity - inp.nitrateMgL) * inp.flow) / 1000,
  );
  return {
    carbonaceousKgD,
    nitrificationKgD,
    denitrificationCreditKgD,
    totalKgD: carbonaceousKgD + nitrificationKgD - denitrificationCreditKgD,
  };
}

/** SOTE (%) interpolated from diffuser depth — sheet 6 estimate column. */
export function soteFromDepth(depthM: number): number {
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

export interface AerationTransferConstants {
  /** O₂ transfer correction factor @20°C (alpha). */
  alpha: number;
  /** O₂ solubility ratio process/clean water (beta). */
  beta: number;
  /** Fouling factor (F). */
  foulingFactor: number;
  /** Diffuser depth, m. */
  diffuserDepthM: number;
  /** Minimum DO maintained, mg/L. */
  minDOmgL: number;
}

export interface AerationTransfer {
  /** SOTE (clean-water) fraction. */
  soteFraction: number;
  /** Overall field oxygen-transfer efficiency (OTE) fraction. */
  oteFraction: number;
  /** Nm³ → Am³ conversion factor at site. */
  am3hFactor: number;
  /** Site barometric pressure, kPa. */
  sitePressureKpa: number;
}

/** Field oxygen-transfer efficiency at the site (sheet 6). */
export function aerationTransfer(
  c: AerationTransferConstants,
  tempC: number,
  elevationM: number,
): AerationTransfer {
  const soteFraction = soteFromDepth(c.diffuserDepthM) / 100;
  const alphaT = arrhenius(c.alpha, 1.024, tempC);
  const Pb = sitePressureKpa(elevationM);
  const omega = Pb / STD_PRESSURE_KPA;
  const cs20 = doSaturation(20) * omega;
  const csInf = cs20 * (1 + 0.4 * (c.diffuserDepthM / 10.33));
  const tau = doSaturation(tempC) / doSaturation(20);
  const oteOverSote = ((tau * c.beta * omega * csInf - c.minDOmgL) / csInf)
    * 1.024 ** (tempC - 20)
    * (alphaT * c.foulingFactor);
  return {
    soteFraction,
    oteFraction: oteOverSote * soteFraction,
    am3hFactor: (STD_PRESSURE_KPA / Pb) * ((273 + 25) / 273),
    sitePressureKpa: Pb,
  };
}

/** Process air flow (Am³/h) to deliver an aerobic O₂ demand at a given OTE. */
export function processAirAm3h(aerobicO2KgD: number, oteFraction: number, am3hFactor: number): number {
  const nm3h = aerobicO2KgD / (O2_FRACTION_OF_AIR * AIR_DENSITY_FACTOR * oteFraction * 24);
  return nm3h * am3hFactor;
}

/** Blower shaft power (kW) for an air flow against diffuser + static head. */
export function blowerKW(airAm3h: number, diffuserDepthM: number, efficiency = 0.72): number {
  const deltaP_Pa = (diffuserDepthM * 9.81 + 15) * 1000;
  return (airAm3h * deltaP_Pa) / (3600 * 1000 * efficiency);
}

export { O2_FRACTION_OF_AIR, AIR_DENSITY_FACTOR };
