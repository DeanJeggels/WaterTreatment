import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'flow', label: 'Flow', unit: 'm³/d', min: 1, max: 1000000, step: 100, defaultValue: 10000 },
  { key: 'COD', label: 'Total COD', unit: 'mg/L', min: 0, max: 2000, step: 10, defaultValue: 500 },
  { key: 'sCOD', label: 'Soluble COD', unit: 'mg/L', min: 0, max: 1000, step: 10, defaultValue: 200 },
  { key: 'BOD5', label: 'BOD₅', unit: 'mg/L', min: 0, max: 1000, step: 10, defaultValue: 250 },
  { key: 'TKN', label: 'TKN', unit: 'mgN/L', min: 0, max: 200, step: 1, defaultValue: 40 },
  { key: 'NH3N', label: 'NH₃-N', unit: 'mgN/L', min: 0, max: 150, step: 1, defaultValue: 25 },
  { key: 'NO3N', label: 'NO₃-N', unit: 'mgN/L', min: 0, max: 50, step: 0.1, defaultValue: 0.5 },
  { key: 'TP', label: 'Total P', unit: 'mgP/L', min: 0, max: 50, step: 0.5, defaultValue: 8 },
  { key: 'TSS', label: 'TSS', unit: 'mg/L', min: 0, max: 2000, step: 10, defaultValue: 250 },
  { key: 'VSS', label: 'VSS', unit: 'mg/L', min: 0, max: 1500, step: 10, defaultValue: 200 },
  { key: 'pH', label: 'pH', unit: '', min: 4, max: 10, step: 0.1, defaultValue: 7.2 },
  { key: 'alkalinity', label: 'Alkalinity', unit: 'mmol/L', min: 0, max: 20, step: 0.5, defaultValue: 5 },
  { key: 'DO', label: 'DO', unit: 'mg/L', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  { key: 'temperature', label: 'Temperature', unit: '°C', min: 0, max: 40, step: 0.5, defaultValue: 20 },
];

export const influentDefinition: UnitDefinition = {
  type: 'influent',
  label: 'Influent',
  description: 'Raw wastewater feed — define water quality entering the plant',
  icon: 'droplets',
  handles: [
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Influent implements ProcessUnit {
  type = 'influent' as const;
  constructor(public parameters: Record<string, number>) {}

  process(_inputs: WaterQuality[]): ProcessResult {
    const p = this.parameters;
    const output: WaterQuality = {
      flow: p.flow ?? 10000,
      COD: p.COD ?? 500,
      sCOD: p.sCOD ?? 200,
      BOD5: p.BOD5 ?? 250,
      TKN: p.TKN ?? 40,
      NH3N: p.NH3N ?? 25,
      NO3N: p.NO3N ?? 0.5,
      TP: p.TP ?? 8,
      TSS: p.TSS ?? 250,
      VSS: p.VSS ?? 200,
      pH: p.pH ?? 7.2,
      alkalinity: p.alkalinity ?? 5,
      DO: p.DO ?? 0,
      temperature: p.temperature ?? 20,
    };

    return {
      outputs: { out: output },
      metadata: {},
    };
  }
}
