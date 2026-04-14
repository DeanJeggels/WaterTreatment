import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';

const parameterSchema: ParameterField[] = [
  { key: 'volume', label: 'Volume', unit: 'm³', min: 100, max: 50000, step: 100, defaultValue: 2000 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5 },
  { key: 'denitrification_eff', label: 'Denitrification Efficiency', unit: '%', min: 0, max: 100, step: 5, defaultValue: 85 },
  { key: 'cod_n_ratio', label: 'COD:N Ratio', unit: 'mgCOD/mgN', min: 3, max: 10, step: 0.5, defaultValue: 6 },
];

export const bioreactorAnoxicDefinition: UnitDefinition = {
  type: 'bioreactor_anoxic',
  label: 'Anoxic Bioreactor',
  description: 'Denitrification — NO₃ → N₂ using COD as electron donor',
  icon: 'moon',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class BioreactorAnoxic implements ProcessUnit {
  type = 'bioreactor_anoxic' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const volume = p.volume ?? 2000;
    const denitEff = (p.denitrification_eff ?? 85) / 100;
    const codNRatio = p.cod_n_ratio ?? 6;

    const hrt = volume / inf.flow;

    // Denitrification
    const no3Removed = inf.NO3N * denitEff;
    const no3Out = inf.NO3N - no3Removed;

    // COD consumed for denitrification
    const codConsumed = no3Removed * codNRatio;
    const sCOD_out = Math.max(0, inf.sCOD - codConsumed);
    const codOut = Math.max(0, inf.COD - codConsumed);

    // Alkalinity recovery: 3.57 mg CaCO3/mg NO3-N = 0.0714 mmol/L per mgN/L
    const alkRecovered = no3Removed * 3.57 / 50;
    const alkOut = inf.alkalinity + alkRecovered;

    // TKN unchanged in anoxic (no nitrification)
    // BOD slightly reduced
    const bodOut = Math.max(0, inf.BOD5 * 0.95);

    const output: WaterQuality = {
      flow: inf.flow,
      COD: codOut,
      sCOD: sCOD_out,
      BOD5: bodOut,
      TKN: inf.TKN,
      NH3N: inf.NH3N,
      NO3N: Math.max(0, no3Out),
      TP: inf.TP,
      TSS: inf.TSS,
      VSS: inf.VSS,
      pH: inf.pH,
      alkalinity: alkOut,
      DO: 0, // anoxic
      temperature: inf.temperature,
    };

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt * 24,
        NO3_removed: no3Removed,
        COD_consumed_denitrification: codConsumed,
        alkalinity_recovered: alkRecovered,
      },
      ...emptyUnitOutputs(),
    };
  }
}
