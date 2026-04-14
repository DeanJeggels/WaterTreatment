import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Grit pump + cyclone separator + air diffusers
// Source: Typical SA supplier quote 2025
const GRIT_EQUIPMENT_ZAR = 180000;
// Typical grit production (m³ / ML influent)
const GRIT_M3_PER_ML = 0.015;

const parameterSchema: ParameterField[] = [
  { key: 'hrt_min', label: 'HRT at peak', unit: 'min', min: 2, max: 6, step: 0.5, defaultValue: 4 },
  { key: 'peak_factor', label: 'Peak factor', unit: '', min: 1.0, max: 4.0, step: 0.1, defaultValue: 2.5 },
];

export const gritRemovalDefinition: UnitDefinition = {
  type: 'grit_removal',
  label: 'Grit Removal',
  description: 'Aerated grit chamber — removes sand and grit >0.2 mm',
  icon: 'circle',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class GritRemoval implements ProcessUnit {
  type = 'grit_removal' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const peakFactor = p.peak_factor ?? 2.5;
    const hrt_min = Math.max(2, Math.min(6, p.hrt_min ?? 4));
    const q_peak = inf.flow * peakFactor;
    const volume = (q_peak * hrt_min) / 1440;
    const airRate_m3_min = 0.3 * Math.sqrt(volume / 10);
    const airRate_m3_h = airRate_m3_min * 60;
    const tssRemoval = 0.07;
    const gritProd = (inf.flow / 1000) * GRIT_M3_PER_ML;

    const output: WaterQuality = {
      ...inf,
      TSS: inf.TSS * (1 - tssRemoval),
      VSS: inf.VSS * (1 - tssRemoval * 0.5),
    };

    const installedKW = airRate_m3_h * 0.05;
    const base = emptyUnitOutputs();
    base.sizing = {
      volume: { value: volume, unit: 'm3' },
      hrt: { value: hrt_min, unit: 'min' },
      airFlowRate: { value: airRate_m3_h, unit: 'm3/h' },
    };
    base.energy = {
      installedKW,
      dailyKWh: installedKW * 24,
      records: [
        {
          label: 'Air supply for grit agitation',
          symbol: 'Q_air',
          equation: 'Q_air ≈ 0.3 × √(V/10)',
          inputs: { V: { value: volume, unit: 'm3', source: 'grit tank volume' } },
          result: { value: airRate_m3_h, unit: 'm3/h' },
          citation: 'Metcalf & Eddy (2014) Ch. 5 — aerated grit chamber',
        },
      ],
    };
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Aerated grit chamber civils (${volume.toFixed(1)} m³)`,
          quantity: volume,
          unit: 'm3',
          unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
          sourceCitation: 'CH-ISE internal estimate 2026',
        },
        {
          category: 'mechanical',
          description: 'Grit pump + cyclone + air diffusers',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: GRIT_EQUIPMENT_ZAR,
          sourceCitation: 'Typical SA supplier quote 2025',
        },
      ],
      total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + GRIT_EQUIPMENT_ZAR,
    };
    base.consumables = [
      {
        item: 'Grit disposal to landfill',
        daily: gritProd,
        unit: 'm3/d',
        citation: 'Typical SA landfill rate 2025',
      },
    ];
    base.calculationRecords = [
      {
        label: 'Grit chamber HRT at peak',
        symbol: 'HRT',
        equation: 'HRT = V × 1440 / Q_peak',
        inputs: {
          V: { value: volume, unit: 'm3', source: 'tank volume' },
          Q_peak: { value: q_peak, unit: 'm3/d', source: 'Q × PF' },
        },
        result: { value: hrt_min, unit: 'min' },
        citation: 'Metcalf & Eddy (2014) Ch. 5 — 3-5 min at peak',
      },
    ];

    return {
      outputs: { out: output },
      metadata: { grit_m3_per_day: gritProd },
      ...base,
    };
  }
}
