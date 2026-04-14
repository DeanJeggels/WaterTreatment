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
    return {
      outputs: { out: mixed },
      metadata: { num_inputs: inputs.length },
      ...emptyUnitOutputs(),
    };
  }
}
