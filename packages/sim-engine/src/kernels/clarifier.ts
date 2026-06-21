/**
 * Clarifier hydraulic kernels — surface overflow rate (SOR) and solids loading
 * rate (SLR) sizing checks (Metcalf & Eddy). Pure functions.
 */

/** Surface overflow rate, m/h, at the given flow and surface area. */
export function surfaceOverflowRateMph(flowM3d: number, areaM2: number): number {
  if (areaM2 <= 0) return Infinity;
  return flowM3d / areaM2 / 24;
}

/** Solids loading rate, kg/m²·h, for MLSS at the given flow and area. */
export function solidsLoadingRateKgM2h(flowM3d: number, mlssMgL: number, areaM2: number): number {
  if (areaM2 <= 0) return Infinity;
  return (flowM3d * mlssMgL) / (areaM2 * 1000 * 24);
}

/** Minimum clarifier surface area (m²) to satisfy an SOR limit at peak flow. */
export function areaFromSOR(peakFlowM3d: number, sorLimitMph: number): number {
  if (sorLimitMph <= 0) return Infinity;
  return peakFlowM3d / (sorLimitMph * 24);
}

/** Minimum clarifier surface area (m²) to satisfy an SLR limit. */
export function areaFromSLR(flowM3d: number, mlssMgL: number, slrLimitKgM2h: number): number {
  if (slrLimitKgM2h <= 0) return Infinity;
  return (flowM3d * mlssMgL) / (slrLimitKgM2h * 1000 * 24);
}
