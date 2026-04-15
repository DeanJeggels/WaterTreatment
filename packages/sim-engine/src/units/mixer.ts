import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition } from '../types';
import { mixStreams, emptyUnitOutputs } from '../types';

export const mixerDefinition: UnitDefinition = {
  type: 'mixer',
  label: 'Mixer',
  description: 'Combine two or more streams into one — pure mass balance',
  icon: 'merge',
  handles: [
    { id: 'in1', label: 'Input 1', position: 'left', type: 'input' },
    { id: 'in2', label: 'Input 2', position: 'top', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: {},
  parameterSchema: [],
};

export class Mixer implements ProcessUnit {
  type = 'mixer' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const mixed = mixStreams(inputs);

    const base = emptyUnitOutputs();
    const totalFlow = inputs.reduce((sum, s) => sum + s.flow, 0);
    base.calculationRecords = [
      {
        label: 'Combined flow',
        symbol: 'Qmix',
        equation: 'Qmix = Σ Qi',
        inputs: Object.fromEntries(
          inputs.map((s, i) => [
            `Q${i + 1}`,
            { value: s.flow, unit: 'm3/d', source: `stream ${i + 1}` },
          ]),
        ),
        result: { value: totalFlow, unit: 'm3/d' },
        citation: 'Flow bookkeeping',
      },
      {
        label: 'Flow-weighted COD',
        symbol: 'CODmix',
        equation: 'CODmix = Σ (Qi × CODi) / Σ Qi',
        inputs: {},
        result: { value: mixed.COD, unit: 'mg/L' },
        citation: 'Mass balance — mixStreams() helper',
      },
    ];

    return {
      outputs: { out: mixed },
      metadata: { num_inputs: inputs.length },
      ...base,
    };
  }
}
