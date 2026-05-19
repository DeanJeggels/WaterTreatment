import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField, UpstreamContext } from '../types';
import { emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

const HST_THRESHOLD_KW = 50;

const parameterSchema: ParameterField[] = [
  { key: 'ote', label: 'Overall transfer efficiency', unit: '', min: 0.05, max: 0.15, step: 0.005, defaultValue: 0.08 },
  { key: 'diffuser_depth_m', label: 'Diffuser submergence', unit: 'm', min: 2, max: 8, step: 0.5, defaultValue: 4.5 },
  { key: 'o2_demand_kg_per_day', label: 'O₂ demand (manual override)', unit: 'kgO/d', min: 0, max: 20000, step: 10, defaultValue: 0, description: 'Leave at 0 to auto-pull from the connected aerobic reactor.' },
];

export const aerationBlowerDefinition: UnitDefinition = {
  type: 'aeration_blower',
  label: 'Aeration Blower',
  description: 'Air blower supplying process air to diffusers — sized from O₂ demand',
  icon: 'fan',
  handles: [
    { id: 'aerobic_link', label: 'O₂ demand link', position: 'left', type: 'input' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class AerationBlower implements ProcessUnit {
  type = 'aeration_blower' as const;
  constructor(public parameters: Record<string, number>) {}

  process(_inputs: WaterQuality[], upstreamContext?: UpstreamContext): ProcessResult {
    const p = this.parameters;

    const manualO2 = Math.max(0, p.o2_demand_kg_per_day ?? 0);
    const upstreamMeta = upstreamContext?.nodeMetadata?.aerobic_link;
    const upstreamO2_mgPerL = typeof upstreamMeta?.O2_demand_total === 'number' ? upstreamMeta.O2_demand_total : 0;
    const upstreamFlow = typeof upstreamMeta?.flow_for_O2 === 'number' ? upstreamMeta.flow_for_O2 : 0;
    const upstreamO2_kgPerD = (upstreamO2_mgPerL * upstreamFlow) / 1000;
    const o2 = manualO2 > 0 ? manualO2 : upstreamO2_kgPerD;
    const o2Source: 'manual' | 'upstream_aerobic' = manualO2 > 0 ? 'manual' : 'upstream_aerobic';
    const ote = Math.max(0.05, Math.min(0.15, p.ote ?? 0.08));
    const depth = p.diffuser_depth_m ?? 4.5;

    // Q_air = O2_g_d / (O2 density × vol frac × OTE) → L air/d, then / 1000 / 24 → m³/hr
    const q_air = (o2 * 1000) / (0.21 * 1.421 * ote * 24 * 1000);

    const deltaP_kPa = depth * 9.81 + 15;
    const deltaP_Pa = deltaP_kPa * 1000;

    const eta = 0.72;
    const installedKW = (q_air * deltaP_Pa) / (3600 * 1000 * eta);
    const dailyKWh = installedKW * 24;

    const isHst = installedKW > HST_THRESHOLD_KW;
    const blowerPrice = isHst ? getPrice('hst_turbo_blower') : getPrice('pd_blower_small');
    const blowerDescription = isHst
      ? 'HST turbo blower (Sulzer/APG Neuros class)'
      : 'PD blower (Aerzen/WEG class)';

    const base = emptyUnitOutputs();
    base.sizing = {
      airFlow: { value: q_air, unit: 'Am³/hr' },
      deltaP: { value: deltaP_kPa, unit: 'kPa' },
    };
    base.energy = {
      installedKW,
      dailyKWh,
      records: [
        {
          label: 'Blower shaft power',
          symbol: 'P',
          equation: 'P = Q_air × ΔP / (η × 3600 × 1000)',
          inputs: {
            Q_air: { value: q_air, unit: 'Am³/hr', source: 'calculated air flow' },
            dP: { value: deltaP_Pa, unit: 'Pa', source: 'depth + losses' },
            eta: { value: eta, unit: '', source: 'blower efficiency' },
          },
          result: { value: installedKW, unit: 'kW' },
          citation: 'ASCE 2-06 / isothermal compression',
        },
      ],
    };
    base.capex = {
      lineItems: [
        {
          category: 'mechanical',
          description: blowerDescription,
          quantity: 1,
          unit: 'ea',
          unitPriceZar: blowerPrice.unitPriceZar,
          sourceCitation: blowerPrice.source,
        },
      ],
      total: blowerPrice.unitPriceZar,
    };
    base.calculationRecords = [
      {
        label: 'Required air flow',
        symbol: 'Q_air',
        equation: 'Q_air = O2 × 1000 / (0.21 × 1.421 × OTE × 24)',
        inputs: {
          O2: { value: o2, unit: 'kgO/d', source: 'user input from aerobic reactor' },
          OTE: { value: ote, unit: '', source: 'overall transfer efficiency in process water' },
        },
        result: { value: q_air, unit: 'Am³/hr' },
        citation: 'ASCE 2-06 / WWTP Design.xlsm sheet 6',
      },
      {
        label: 'Blower power',
        symbol: 'P',
        equation: 'P = Q_air × ΔP / (η × 3600 × 1000)',
        inputs: {
          Q_air: { value: q_air, unit: 'Am³/hr', source: 'air flow' },
          dP: { value: deltaP_kPa, unit: 'kPa', source: 'depth + losses' },
          eta: { value: eta, unit: '', source: '72% typical' },
        },
        result: { value: installedKW, unit: 'kW' },
        citation: 'Metcalf & Eddy (2014) Ch. 5 — blower sizing',
      },
    ];

    return {
      outputs: {},
      metadata: { installedKW, q_air, o2_used_kg_per_day: o2, o2_source: o2Source },
      ...base,
    };
  }
}
