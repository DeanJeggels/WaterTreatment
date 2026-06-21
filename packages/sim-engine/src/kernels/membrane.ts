/**
 * Membrane (MBR) kernels — WWTP Design.xlsm sheet 7. Pure functions.
 */
import { O2_FRACTION_OF_AIR, AIR_DENSITY_FACTOR } from './aeration';

export interface MembraneSpec {
  /** Operational design flux, L/m²/h (LMH). */
  fluxLmh: number;
  /** Air-scour coefficient (Nm³/h per m²/1000×60 for hollow-fibre, or per module). */
  scourCoeff: number;
  /** Whether scour scales by membrane area (true) or by module count (false). */
  scourByArea: boolean;
  /** Nominal SMU module membrane area, m². */
  nominalModuleAreaM2: number;
}

export interface MembraneSizingConstants {
  /** Peak factor on AWWF over the operational window. */
  membranePeakFactor: number;
  /** Daily operational duration of the SMU, h. */
  opDurationH: number;
  /** Diffuser depth used for scour O₂ transfer estimate, m. */
  diffuserDepthM: number;
}

export interface MembraneSizing {
  /** Peak permeate duty over the operational window, m³/h. */
  permeateDutyM3h: number;
  /** Required membrane area, m². */
  membraneAreaM2: number;
  /** Number of SMU modules. */
  moduleCount: number;
  /** Membrane area per module, m². */
  moduleAreaM2: number;
  /** Air-scour demand, Nm³/h. */
  airScourNm3h: number;
  /** O₂ credited to aeration from the air scour, kgO/d. */
  scourO2CreditKgD: number;
}

/** MBR membrane area, module count and air scour (sheet 7). */
export function membraneSizing(
  spec: MembraneSpec,
  c: MembraneSizingConstants,
  awwfM3d: number,
  required: boolean,
): MembraneSizing {
  const permeateDutyM3h = (awwfM3d * c.membranePeakFactor) / c.opDurationH;
  const membraneAreaM2 = (permeateDutyM3h * 1000) / spec.fluxLmh;
  const moduleCount = required ? Math.max(1, Math.ceil(membraneAreaM2 / spec.nominalModuleAreaM2)) : 0;
  const moduleAreaM2 = moduleCount > 0 ? membraneAreaM2 / moduleCount : 0;
  const airScourNm3h = required
    ? (spec.scourByArea ? (spec.scourCoeff * membraneAreaM2) / 1000 * 60 : spec.scourCoeff * moduleCount)
    : 0;
  const scourTransferEff = (0.5 * c.diffuserDepthM) / 100;
  const scourO2CreditKgD = airScourNm3h * scourTransferEff * O2_FRACTION_OF_AIR * AIR_DENSITY_FACTOR * 24;
  return { permeateDutyM3h, membraneAreaM2, moduleCount, moduleAreaM2, airScourNm3h, scourO2CreditKgD };
}
