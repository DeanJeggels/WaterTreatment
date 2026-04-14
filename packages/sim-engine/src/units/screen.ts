import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

// Typical screenings production rates (L/ML)
const COARSE_SCREENINGS_L_PER_ML = 40;
const FINE_SCREENINGS_L_PER_ML = 15;

const parameterSchema: ParameterField[] = [
  { key: 'screen_type', label: 'Type (0=coarse, 1=fine)', unit: '', min: 0, max: 1, step: 1, defaultValue: 1, description: '0 = coarse bar rack, 1 = fine step screen' },
  { key: 'bar_spacing_mm', label: 'Bar spacing', unit: 'mm', min: 1, max: 50, step: 1, defaultValue: 3 },
  { key: 'approach_velocity_mps', label: 'Approach velocity', unit: 'm/s', min: 0.3, max: 0.9, step: 0.05, defaultValue: 0.6 },
  { key: 'peak_factor', label: 'Peak factor', unit: '', min: 1.0, max: 4.0, step: 0.1, defaultValue: 2.5 },
  { key: 'channel_depth_m', label: 'Channel depth', unit: 'm', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.0 },
];

export const screenDefinition: UnitDefinition = {
  type: 'screen',
  label: 'Screen',
  description: 'Bar rack or step screen — removes rags, debris, and coarse solids',
  icon: 'filter',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Screen implements ProcessUnit {
  type = 'screen' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const isFine = (p.screen_type ?? 1) >= 0.5;
    const v_app = Math.max(0.3, Math.min(0.9, p.approach_velocity_mps ?? 0.6));
    const peakFactor = p.peak_factor ?? 2.5;
    const depth = p.channel_depth_m ?? 1.0;

    const q_peak_m3s = (inf.flow * peakFactor) / 86400;
    const channelArea = q_peak_m3s / v_app;
    const channelWidth = channelArea / depth;
    const channelLength = 2.0;
    const channelVolume = channelArea * channelLength;

    const g = 9.81;
    const headLoss_m = (v_app * v_app) / (2 * g * 0.7);

    const tssRemovalFrac = isFine ? 0.05 : 0.02;

    const output: WaterQuality = {
      ...inf,
      TSS: inf.TSS * (1 - tssRemovalFrac),
      VSS: inf.VSS * (1 - tssRemovalFrac * 0.9),
    };

    const screenings_L_per_ML = isFine ? FINE_SCREENINGS_L_PER_ML : COARSE_SCREENINGS_L_PER_ML;
    const screenings_m3_per_d = (inf.flow / 1000) * (screenings_L_per_ML / 1000);

    const civilPrice = getPrice('civil_headworks_channel');
    const screenPriceRef = isFine
      ? getPrice('fine_step_screen_huber_rotamat')
      : getPrice('coarse_bar_screen');
    const screenings = getPrice('screenings_landfill_disposal');
    const civilCost = channelVolume * civilPrice.unitPriceZar;

    const base = emptyUnitOutputs();
    base.sizing = {
      channelArea: { value: channelArea, unit: 'm2' },
      channelWidth: { value: channelWidth, unit: 'm' },
      channelDepth: { value: depth, unit: 'm' },
      headLoss: { value: headLoss_m, unit: 'm' },
    };
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Headworks concrete channel (${channelVolume.toFixed(1)} m³)`,
          quantity: channelVolume,
          unit: 'm3',
          unitPriceZar: civilPrice.unitPriceZar,
          sourceCitation: civilPrice.source,
        },
        {
          category: 'mechanical',
          description: isFine ? 'Fine step screen (Huber ROTAMAT Ro5 equivalent)' : 'Coarse mechanical bar rack',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: screenPriceRef.unitPriceZar,
          sourceCitation: screenPriceRef.source,
        },
      ],
      total: civilCost + screenPriceRef.unitPriceZar,
    };
    base.consumables = [
      {
        item: 'Screenings disposal to landfill',
        daily: screenings_m3_per_d,
        unit: 'm3/d',
        citation: screenings.source,
      },
    ];
    base.calculationRecords = [
      {
        label: 'Peak flow',
        symbol: 'Q_peak',
        equation: 'Q_peak = Q × PF',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          PF: { value: peakFactor, unit: '', source: 'user input (typical 2.5)' },
        },
        result: { value: inf.flow * peakFactor, unit: 'm3/d' },
        citation: 'Metcalf & Eddy (2014) Ch. 3',
      },
      {
        label: 'Channel area at peak',
        symbol: 'A_ch',
        equation: 'A_ch = Q_peak / v_approach',
        inputs: {
          Q_peak: { value: q_peak_m3s, unit: 'm3/s', source: 'converted from m3/d' },
          v_approach: { value: v_app, unit: 'm/s', source: 'design assumption' },
        },
        result: { value: channelArea, unit: 'm2' },
        citation: 'Metcalf & Eddy (2014) Ch. 5',
      },
      {
        label: 'Head loss through screen',
        symbol: 'hL',
        equation: 'hL = v² / (2g × 0.7)',
        inputs: {
          v: { value: v_app, unit: 'm/s', source: 'approach velocity' },
          g: { value: g, unit: 'm/s²', source: 'gravity' },
        },
        result: { value: headLoss_m, unit: 'm' },
        citation: 'Kirschmer (1926) simplified — M&E Ch. 5',
      },
    ];

    return {
      outputs: { out: output },
      metadata: {
        is_fine_screen: isFine ? 1 : 0,
        screenings_m3_per_day: screenings_m3_per_d,
      },
      ...base,
    };
  }
}
