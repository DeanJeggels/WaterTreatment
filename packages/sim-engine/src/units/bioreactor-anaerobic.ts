import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'volume', label: 'Volume', unit: 'm³', min: 100, max: 50000, step: 100, defaultValue: 1500 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5 },
  { key: 'p_release_rate', label: 'P Release Rate', unit: 'mgP/mgCOD', min: 0.05, max: 0.8, step: 0.05, defaultValue: 0.3 },
  { key: 'vfa_fraction', label: 'VFA Fraction of sCOD', unit: '', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.2 },
];

export const bioreactorAnaerobicDefinition: UnitDefinition = {
  type: 'bioreactor_anaerobic',
  label: 'Anaerobic Bioreactor',
  description: 'Phosphorus release by PAOs — VFA uptake for enhanced P removal',
  icon: 'flask-conical',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class BioreactorAnaerobic implements ProcessUnit {
  type = 'bioreactor_anaerobic' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {} };
    }

    const volume = p.volume ?? 1500;
    const pReleaseRate = p.p_release_rate ?? 0.3;
    const vfaFraction = p.vfa_fraction ?? 0.2;

    const hrt = volume / inf.flow;

    // VFA uptake by PAOs
    const vfaAvailable = inf.sCOD * vfaFraction;
    const vfaConsumed = vfaAvailable * 0.9; // 90% uptake
    const pReleased = vfaConsumed * pReleaseRate;

    const output: WaterQuality = {
      flow: inf.flow,
      COD: inf.COD - vfaConsumed,
      sCOD: inf.sCOD - vfaConsumed,
      BOD5: inf.BOD5 * 0.95,
      TKN: inf.TKN,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP + pReleased, // P increases in anaerobic zone
      TSS: inf.TSS,
      VSS: inf.VSS,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: 0, // anaerobic
      temperature: inf.temperature,
    };

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt * 24,
        VFA_consumed: vfaConsumed,
        P_released: pReleased,
      },
    };
  }
}
