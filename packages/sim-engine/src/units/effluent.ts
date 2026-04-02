import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, DischargeStandards } from '../types';
import { mixStreams } from '../types';

export const effluentDefinition: UnitDefinition = {
  type: 'effluent',
  label: 'Effluent',
  description: 'Discharge point — displays final water quality and compliance status',
  icon: 'waves',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
  ],
  defaultParameters: {},
  parameterSchema: [],
};

export class Effluent implements ProcessUnit {
  type = 'effluent' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);

    return {
      outputs: { out: inf },
      metadata: {},
    };
  }
}

/** Check effluent compliance against discharge standards */
export function checkCompliance(
  wq: WaterQuality,
  standards: DischargeStandards
): Record<string, { value: number; limit: number; pass: boolean }> {
  const results: Record<string, { value: number; limit: number; pass: boolean }> = {};

  if (standards.COD !== undefined) {
    results.COD = { value: wq.COD, limit: standards.COD, pass: wq.COD <= standards.COD };
  }
  if (standards.BOD5 !== undefined) {
    results.BOD5 = { value: wq.BOD5, limit: standards.BOD5, pass: wq.BOD5 <= standards.BOD5 };
  }
  if (standards.NH3N !== undefined) {
    results.NH3N = { value: wq.NH3N, limit: standards.NH3N, pass: wq.NH3N <= standards.NH3N };
  }
  if (standards.NO3N !== undefined) {
    results.NO3N = { value: wq.NO3N, limit: standards.NO3N, pass: wq.NO3N <= standards.NO3N };
  }
  if (standards.TSS !== undefined) {
    results.TSS = { value: wq.TSS, limit: standards.TSS, pass: wq.TSS <= standards.TSS };
  }
  if (standards.TP !== undefined) {
    results.TP = { value: wq.TP, limit: standards.TP, pass: wq.TP <= standards.TP };
  }
  if (standards.pH_min !== undefined && standards.pH_max !== undefined) {
    results.pH = {
      value: wq.pH,
      limit: standards.pH_max,
      pass: wq.pH >= standards.pH_min && wq.pH <= standards.pH_max,
    };
  }

  return results;
}
