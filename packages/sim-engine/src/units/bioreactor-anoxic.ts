import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;

const parameterSchema: ParameterField[] = [
  { key: 'volume', label: 'Volume', unit: 'm³', min: 100, max: 50000, step: 100, defaultValue: 2000 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5, advanced: true },
  { key: 'denitrification_eff', label: 'Denitrification Efficiency', unit: '%', min: 0, max: 100, step: 5, defaultValue: 85, advanced: true },
  { key: 'cod_n_ratio', label: 'COD:N Ratio', unit: 'mgCOD/mgN', min: 3, max: 10, step: 0.5, defaultValue: 6, advanced: true },
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

    const depth = p.depth ?? 4.5;
    const hrt_h = hrt * 24;
    const mixerCount = Math.max(1, Math.ceil(volume / MIXER_VOLUME_PER_UNIT_M3));
    const installedKW = mixerCount * MIXER_KW_PER_UNIT;
    const dailyKWh = installedKW * 24;
    const K2 = 0.1;
    const Xv = inf.TSS * 0.8;
    const dp1 = (K2 * Xv * volume) / inf.flow;

    const base = emptyUnitOutputs();
    base.sizing = {
      volume: { value: volume, unit: 'm3' },
      depth: { value: depth, unit: 'm' },
      HRT: { value: hrt_h, unit: 'h' },
    };
    base.energy = {
      installedKW,
      dailyKWh,
      records: [
        {
          label: 'Mixing power demand',
          symbol: 'P_mix',
          equation: 'P_mix = n_mixers × kW_per_mixer',
          inputs: {
            n_mixers: { value: mixerCount, unit: '', source: 'V / 500 m³ per unit' },
            kW_per_mixer: { value: MIXER_KW_PER_UNIT, unit: 'kW', source: 'typical 3 kW submersible' },
          },
          result: { value: installedKW, unit: 'kW' },
          citation: 'Metcalf & Eddy (2014) Ch. 5 — ~5 W/m³ anoxic mixing',
        },
      ],
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const mixerPrice = getPrice('submersible_mixer_3kw');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Anoxic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
          quantity: volume,
          unit: 'm3',
          unitPriceZar: civilPrice.unitPriceZar,
          sourceCitation: civilPrice.source,
        },
        {
          category: 'mechanical',
          description: `Submersible mixer 3kW × ${mixerCount}`,
          quantity: mixerCount,
          unit: 'ea',
          unitPriceZar: mixerPrice.unitPriceZar,
          sourceCitation: mixerPrice.source,
        },
      ],
      total: volume * civilPrice.unitPriceZar + mixerCount * mixerPrice.unitPriceZar,
    };
    base.calculationRecords = [
      {
        label: 'Hydraulic retention time',
        symbol: 'HRT',
        equation: 'HRT = V / Q × 24',
        inputs: {
          V: { value: volume, unit: 'm3', source: 'user input' },
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
        },
        result: { value: hrt_h, unit: 'h' },
        citation: 'Ekama (1984) — typical anoxic HRT 1-3h',
      },
      {
        label: 'Denitrification capacity',
        symbol: 'Dp1',
        equation: 'Dp1 ≈ K2 × MLVSS × V / Q',
        inputs: {
          K2: { value: K2, unit: 'mgN/mgVSS·d', source: 'Ekama 1984 Table 4.2 at 20°C' },
          MLVSS: { value: Xv, unit: 'mg/L', source: '0.8 × reactor MLSS' },
          V: { value: volume, unit: 'm3', source: 'user input' },
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
        },
        result: { value: dp1, unit: 'mgN/L' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.15 (simplified)',
      },
    ];

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt_h,
        NO3_removed: no3Removed,
        COD_consumed_denitrification: codConsumed,
        alkalinity_recovered: alkRecovered,
      },
      ...base,
    };
  }
}
