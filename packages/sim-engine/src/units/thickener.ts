import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'target_solids_pct', label: 'Target Solids', unit: '%', min: 1, max: 10, step: 0.5, defaultValue: 5 },
  { key: 'capture_efficiency', label: 'Capture Efficiency', unit: '%', min: 80, max: 99, step: 1, defaultValue: 95 },
];

export const thickenerDefinition: UnitDefinition = {
  type: 'thickener',
  label: 'Thickener',
  description: 'Concentrate sludge by removing water',
  icon: 'funnel',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'thickened', label: 'Thickened', position: 'bottom', type: 'output' },
    { id: 'overflow', label: 'Overflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Thickener implements ProcessUnit {
  type = 'thickener' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { thickened: zero, overflow: zero }, metadata: {} };
    }

    const targetSolids = (p.target_solids_pct ?? 5) / 100;
    const captureEff = (p.capture_efficiency ?? 95) / 100;

    const targetTSS = targetSolids * 1000000; // % to mg/L (1% = 10,000 mg/L)
    const solidsCaptured = inf.TSS * inf.flow * captureEff; // mg/L * m³/d
    const flowThickened = solidsCaptured / targetTSS;
    const flowOverflow = Math.max(0.001, inf.flow - flowThickened); // avoid zero flow

    const thickened: WaterQuality = {
      flow: flowThickened,
      COD: inf.COD * (inf.TSS > 0 ? (targetTSS / inf.TSS) : 1),
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (inf.TSS > 0 ? (targetTSS / inf.TSS) * 0.5 : 1),
      TKN: inf.TKN * (inf.TSS > 0 ? (targetTSS / inf.TSS) * 0.3 : 1),
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP * (inf.TSS > 0 ? (targetTSS / inf.TSS) * 0.3 : 1),
      TSS: targetTSS,
      VSS: inf.VSS > 0 ? targetTSS * (inf.VSS / inf.TSS) : targetTSS * 0.8,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: 0,
      temperature: inf.temperature,
    };

    const overflow: WaterQuality = {
      flow: flowOverflow,
      COD: inf.sCOD + (inf.COD - inf.sCOD) * (1 - captureEff),
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (1 - captureEff * 0.5),
      TKN: inf.NH3N + (inf.TKN - inf.NH3N) * (1 - captureEff),
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP * (1 - captureEff * 0.3),
      TSS: inf.TSS * (1 - captureEff),
      VSS: inf.VSS * (1 - captureEff),
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    return {
      outputs: { thickened, overflow },
      metadata: {
        solids_captured_pct: captureEff * 100,
        thickened_flow: flowThickened,
        thickened_TSS: targetTSS,
      },
    };
  }
}
