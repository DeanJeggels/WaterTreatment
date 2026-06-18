/**
 * validateInputs — deterministic, pure, no-network, no-AI validation of
 * DesignInputs. Per-field range floors/ceilings are REUSED from sim-engine's
 * influent parameterSchema (min/max) so the form can never feed the engine a
 * value the engine itself would reject; the cross-field rules are new.
 */
import { unitDefinitions } from '@repo/sim-engine';
import type { DesignInputs, InfluentQuality } from './inputs';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Floors/ceilings for influent fields, sourced verbatim from sim-engine. */
function influentRange(key: string): { min: number; max: number } | undefined {
  const field = unitDefinitions.influent.parameterSchema.find((f) => f.key === key);
  return field ? { min: field.min, max: field.max } : undefined;
}

/** Influent fields whose units match sim-engine's influent params 1:1. */
const RANGE_KEYS: Array<keyof InfluentQuality> = [
  'COD', 'sCOD', 'BOD5', 'TKN', 'NH3N', 'TP', 'TSS', 'VSS', 'pH', 'temperature',
];

// Very lenient site-area sanity floor: a real preliminary WWTP footprint is far
// larger, but this only catches absurd inputs (site smaller than the tanks).
const MIN_FOOTPRINT_M2_PER_M3D = 0.04;

export function validateInputs(input: DesignInputs): ValidationResult {
  const errors: ValidationError[] = [];
  const add = (field: string, message: string, code: string) => errors.push({ field, message, code });

  // ---- required fields ----
  if (!input.meta.projectName || input.meta.projectName.trim() === '') {
    add('meta.projectName', 'Project name is required.', 'required');
  }

  // ---- flow ----
  const flowRange = influentRange('flow');
  if (!(input.designFlowM3d > 0)) {
    add('designFlowM3d', 'Design flow must be greater than 0.', 'range');
  } else if (flowRange && (input.designFlowM3d < flowRange.min || input.designFlowM3d > flowRange.max)) {
    add('designFlowM3d', `Design flow must be between ${flowRange.min} and ${flowRange.max} m³/d.`, 'range');
  }

  // ---- peak factor ----
  if (!(input.peakFactor >= 1)) {
    add('peakFactor', 'Peak factor must be at least 1.', 'range');
  }

  // ---- influent ranges (reused from sim-engine) ----
  for (const key of RANGE_KEYS) {
    const value = input.influent[key];
    if (value === undefined) continue;
    const range = influentRange(key);
    if (range && (value < range.min || value > range.max)) {
      add(`influent.${key}`, `${key} must be between ${range.min} and ${range.max}.`, 'range');
    }
  }
  if (input.influent.alkalinity !== undefined && input.influent.alkalinity < 0) {
    add('influent.alkalinity', 'Alkalinity must be ≥ 0.', 'range');
  }

  // ---- cross-field rules (NEW) ----
  if (input.influent.sCOD > input.influent.COD) {
    add('influent.sCOD', 'Soluble COD cannot exceed total COD.', 'cross-field');
  }
  if (input.influent.NH3N > input.influent.TKN) {
    add('influent.NH3N', 'Ammonia (NH₃-N) cannot exceed TKN.', 'cross-field');
  }

  // effluent targets must not exceed the corresponding influent concentration.
  const targets = input.effluentTargets;
  const targetVsInfluent: Array<[number | undefined, number, string, string]> = [
    [targets.COD, input.influent.COD, 'effluentTargets.COD', 'COD'],
    [targets.TSS, input.influent.TSS, 'effluentTargets.TSS', 'TSS'],
    [targets.TP, input.influent.TP, 'effluentTargets.TP', 'TP'],
    [targets.NH3N, input.influent.NH3N, 'effluentTargets.NH3N', 'NH₃-N'],
  ];
  for (const [target, influent, field, label] of targetVsInfluent) {
    if (target !== undefined && target > influent) {
      add(field, `Effluent ${label} target (${target}) cannot exceed influent ${label} (${influent}).`, 'cross-field');
    }
  }

  // ---- site area sanity ----
  if (!(input.siteAreaM2 > 0)) {
    add('siteAreaM2', 'Site area must be greater than 0.', 'range');
  } else {
    const minFootprint = input.designFlowM3d * MIN_FOOTPRINT_M2_PER_M3D;
    if (input.siteAreaM2 < minFootprint) {
      add(
        'siteAreaM2',
        `Site area (${Math.round(input.siteAreaM2)} m²) is too small for a ${input.designFlowM3d} m³/d plant ` +
          `(needs at least ~${Math.round(minFootprint)} m²).`,
        'site-area',
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
