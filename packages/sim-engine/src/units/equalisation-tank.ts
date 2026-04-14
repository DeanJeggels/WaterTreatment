import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;

const parameterSchema: ParameterField[] = [
  { key: 'hrt_hours', label: 'HRT', unit: 'h', min: 2, max: 24, step: 0.5, defaultValue: 6 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5 },
];

export const equalisationTankDefinition: UnitDefinition = {
  type: 'equalisation_tank',
  label: 'Equalisation Tank',
  description: 'Balance tank — buffer flow and load variations',
  icon: 'square',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class EqualisationTank implements ProcessUnit {
  type = 'equalisation_tank' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const hrt_h = p.hrt_hours ?? 6;
    const depth = p.depth ?? 4.5;
    const volume = (inf.flow * hrt_h) / 24;
    const mixerCount = Math.max(1, Math.ceil(volume / MIXER_VOLUME_PER_UNIT_M3));
    const installedKW = mixerCount * MIXER_KW_PER_UNIT;
    const dailyKWh = installedKW * 24;

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
          citation: 'Metcalf & Eddy (2014) Ch. 5 — ~5 W/m³ mixing',
        },
      ],
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const mixerPrice = getPrice('submersible_mixer_3kw');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `EQ tank reinforced concrete (${volume.toFixed(0)} m³)`,
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
        equation: 'HRT = V × 24 / Q',
        inputs: {
          V: { value: volume, unit: 'm3', source: 'tank volume' },
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
        },
        result: { value: hrt_h, unit: 'h' },
        citation: 'Metcalf & Eddy (2014) Ch. 5 — EQ tank typical 4-12 h',
      },
    ];

    return {
      outputs: { out: { ...inf } },
      metadata: { HRT_hours: hrt_h },
      ...base,
    };
  }
}
