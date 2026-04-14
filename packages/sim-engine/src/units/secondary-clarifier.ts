import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'surface_area', label: 'Surface Area', unit: 'm²', min: 50, max: 10000, step: 50, defaultValue: 800 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 6, step: 0.5, defaultValue: 4.0 },
  { key: 'tss_removal', label: 'TSS Removal', unit: '%', min: 95, max: 99.9, step: 0.1, defaultValue: 99.5 },
  { key: 'uo_ratio', label: 'U/O Ratio', unit: '', min: 0.3, max: 1.5, step: 0.05, defaultValue: 0.75 },
];

export const secondaryClarifierDefinition: UnitDefinition = {
  type: 'secondary_clarifier',
  label: 'Secondary Clarifier',
  description: 'Settling of biological floc — produces clarified effluent + concentrated sludge',
  icon: 'triangle',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'overflow', label: 'Effluent', position: 'right', type: 'output' },
    { id: 'underflow', label: 'RAS/WAS', position: 'bottom', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class SecondaryClarifier implements ProcessUnit {
  type = 'secondary_clarifier' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { overflow: zero, underflow: zero }, metadata: {}, ...emptyUnitOutputs() };
    }

    const tssR = (p.tss_removal ?? 99.5) / 100;
    const uoRatio = p.uo_ratio ?? 0.75;
    const surfaceArea = p.surface_area ?? 800;

    const flowOverflow = inf.flow / (1 + uoRatio);
    const flowUnderflow = inf.flow - flowOverflow;

    // Overflow: clarified effluent
    const overflow: WaterQuality = {
      flow: flowOverflow,
      COD: inf.sCOD + (inf.COD - inf.sCOD) * (1 - tssR), // soluble passes + tiny particulate
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (1 - tssR * 0.5), // some BOD is particulate
      TKN: inf.NH3N + (inf.TKN - inf.NH3N) * (1 - tssR),
      NH3N: inf.NH3N, // soluble passes
      NO3N: inf.NO3N,
      TP: inf.TP * (1 - tssR * 0.3), // some P is in particulate
      TSS: inf.TSS * (1 - tssR),
      VSS: inf.VSS * (1 - tssR),
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    // Underflow: concentrated sludge
    const underflow: WaterQuality = {
      flow: flowUnderflow,
      COD: (inf.COD * inf.flow - overflow.COD * flowOverflow) / flowUnderflow,
      sCOD: inf.sCOD,
      BOD5: (inf.BOD5 * inf.flow - overflow.BOD5 * flowOverflow) / flowUnderflow,
      TKN: (inf.TKN * inf.flow - overflow.TKN * flowOverflow) / flowUnderflow,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: (inf.TP * inf.flow - overflow.TP * flowOverflow) / flowUnderflow,
      TSS: (inf.TSS * inf.flow - overflow.TSS * flowOverflow) / flowUnderflow,
      VSS: (inf.VSS * inf.flow - overflow.VSS * flowOverflow) / flowUnderflow,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    return {
      outputs: { overflow, underflow },
      metadata: {
        surface_loading_rate: inf.flow / surfaceArea,
        underflow_TSS: underflow.TSS,
        overflow_TSS: overflow.TSS,
      },
      ...emptyUnitOutputs(),
    };
  }
}
