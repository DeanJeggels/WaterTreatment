import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyUnitOutputs } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'split_ratio', label: 'Main Flow Ratio', unit: '', min: 0.01, max: 0.99, step: 0.01, defaultValue: 0.95, description: 'Fraction of flow to main output' },
];

export const splitterDefinition: UnitDefinition = {
  type: 'splitter',
  label: 'Splitter',
  description: 'Split a single flow into two streams (e.g., RAS vs WAS)',
  icon: 'git-branch',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'main', label: 'Main', position: 'right', type: 'output' },
    { id: 'side', label: 'Side', position: 'bottom', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Splitter implements ProcessUnit {
  type = 'splitter' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const ratio = Math.min(0.99, Math.max(0.01, this.parameters.split_ratio ?? 0.95));

    const main: WaterQuality = { ...inf, flow: inf.flow * ratio };
    const side: WaterQuality = { ...inf, flow: inf.flow * (1 - ratio) };

    const base = emptyUnitOutputs();
    base.calculationRecords = [
      {
        label: 'Split flow to main',
        symbol: 'Qmain',
        equation: 'Qmain = Q × r',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          r: { value: ratio, unit: '', source: 'split ratio parameter' },
        },
        result: { value: inf.flow * ratio, unit: 'm3/d' },
        citation: 'Flow bookkeeping',
      },
      {
        label: 'Split flow to side',
        symbol: 'Qside',
        equation: 'Qside = Q × (1 − r)',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          r: { value: ratio, unit: '', source: 'split ratio parameter' },
        },
        result: { value: inf.flow * (1 - ratio), unit: 'm3/d' },
        citation: 'Flow bookkeeping',
      },
    ];

    return {
      outputs: { main, side },
      metadata: { split_ratio: ratio },
      ...base,
    };
  }
}
