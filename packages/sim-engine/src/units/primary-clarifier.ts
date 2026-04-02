import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'tss_removal', label: 'TSS Removal', unit: '%', min: 30, max: 90, step: 1, defaultValue: 60 },
  { key: 'bod_removal', label: 'BOD Removal', unit: '%', min: 10, max: 60, step: 1, defaultValue: 30 },
  { key: 'cod_removal', label: 'COD Removal', unit: '%', min: 10, max: 60, step: 1, defaultValue: 30 },
  { key: 'tkn_removal', label: 'TKN Removal', unit: '%', min: 5, max: 30, step: 1, defaultValue: 15 },
  { key: 'tp_removal', label: 'TP Removal', unit: '%', min: 5, max: 25, step: 1, defaultValue: 10 },
  { key: 'surface_area', label: 'Surface Area', unit: 'm²', min: 10, max: 5000, step: 10, defaultValue: 500 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 2, max: 6, step: 0.5, defaultValue: 3.5 },
  { key: 'uo_ratio', label: 'U/O Ratio', unit: '', min: 0.01, max: 0.2, step: 0.01, defaultValue: 0.05 },
];

export const primaryClarifierDefinition: UnitDefinition = {
  type: 'primary_clarifier',
  label: 'Primary Clarifier',
  description: 'Gravity settling — removes settleable solids and associated organics',
  icon: 'cylinder',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'overflow', label: 'Overflow', position: 'right', type: 'output' },
    { id: 'underflow', label: 'Sludge', position: 'bottom', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class PrimaryClarifier implements ProcessUnit {
  type = 'primary_clarifier' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { overflow: zero, underflow: zero }, metadata: {} };
    }

    const tssR = (p.tss_removal ?? 60) / 100;
    const bodR = (p.bod_removal ?? 30) / 100;
    const codR = (p.cod_removal ?? 30) / 100;
    const tknR = (p.tkn_removal ?? 15) / 100;
    const tpR = (p.tp_removal ?? 10) / 100;
    const uoRatio = p.uo_ratio ?? 0.05;

    const flowSludge = inf.flow * uoRatio / (1 + uoRatio);
    const flowOverflow = inf.flow - flowSludge;

    // Mass removed (mg/L * m³/d = g/d when divided by 1000, but we work in concentrations)
    const overflow: WaterQuality = {
      flow: flowOverflow,
      COD: inf.COD * (1 - codR),
      sCOD: inf.sCOD, // soluble passes through
      BOD5: inf.BOD5 * (1 - bodR),
      TKN: inf.TKN * (1 - tknR),
      NH3N: inf.NH3N, // soluble passes through
      NO3N: inf.NO3N,
      TP: inf.TP * (1 - tpR),
      TSS: inf.TSS * (1 - tssR),
      VSS: inf.VSS * (1 - tssR * 0.9),
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    // Sludge: mass balance — what was removed goes to underflow
    const underflow: WaterQuality = {
      flow: flowSludge,
      COD: (inf.COD * inf.flow - overflow.COD * flowOverflow) / flowSludge,
      sCOD: inf.sCOD,
      BOD5: (inf.BOD5 * inf.flow - overflow.BOD5 * flowOverflow) / flowSludge,
      TKN: (inf.TKN * inf.flow - overflow.TKN * flowOverflow) / flowSludge,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: (inf.TP * inf.flow - overflow.TP * flowOverflow) / flowSludge,
      TSS: (inf.TSS * inf.flow - overflow.TSS * flowOverflow) / flowSludge,
      VSS: (inf.VSS * inf.flow - overflow.VSS * flowOverflow) / flowSludge,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    return {
      outputs: { overflow, underflow },
      metadata: {
        surface_loading_rate: inf.flow / (p.surface_area ?? 500),
        hydraulic_retention_time: (p.surface_area ?? 500) * (p.depth ?? 3.5) / inf.flow * 24, // hours
      },
    };
  }
}
