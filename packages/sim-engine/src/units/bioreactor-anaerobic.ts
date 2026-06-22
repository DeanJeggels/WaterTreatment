import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

// Rule of thumb: one 3 kW mixer per 500 m³ of anaerobic volume
const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;
// Typical EBPR anaerobic contact time (Ekama 1984 / WRC TT-16/84: 1-2 h). Used to
// self-size the standalone block; a recognised UCT train overrides the volume with
// the validated mass-fraction split (Van = fan × total reactor volume, sheet 5).
const DEFAULT_ANAEROBIC_HRT_H = 1.0;

const parameterSchema: ParameterField[] = [
  { key: 'anaerobic_fraction', label: 'Anaerobic mass fraction', unit: '', min: 0.05, max: 0.3, step: 0.05, defaultValue: 0.1, description: 'EBPR unaerated mass fraction (fan, UCT). The recognised-train design sizes the zone as fan × total reactor volume.' },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5, advanced: true },
  { key: 'p_release_rate', label: 'P Release Rate', unit: 'mgP/mgCOD', min: 0.05, max: 0.8, step: 0.05, defaultValue: 0.3, advanced: true },
  { key: 'vfa_fraction', label: 'VFA Fraction of sCOD', unit: '', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.2, advanced: true },
];

export const bioreactorAnaerobicDefinition: UnitDefinition = {
  type: 'bioreactor_anaerobic',
  label: 'Anaerobic Bioreactor',
  description: 'Phosphorus release by PAOs — VFA uptake for enhanced P removal',
  icon: 'flask-conical',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class BioreactorAnaerobic implements ProcessUnit {
  type = 'bioreactor_anaerobic' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const pReleaseRate = p.p_release_rate ?? 0.3;
    const vfaFraction = p.vfa_fraction ?? 0.2;

    // Volume is DERIVED (never a stale stored value): standalone it is sized from a
    // typical EBPR contact time; a recognised UCT train overrides it via the store
    // with the mass-fraction split from the validated whole-reactor design.
    const volume = Math.max(50, (DEFAULT_ANAEROBIC_HRT_H / 24) * inf.flow);

    const hrt = volume / inf.flow;

    // VFA uptake by PAOs
    const vfaAvailable = inf.sCOD * vfaFraction;
    const vfaConsumed = vfaAvailable * 0.9; // 90% uptake
    const pReleased = vfaConsumed * pReleaseRate;

    const output: WaterQuality = {
      flow: inf.flow,
      COD: inf.COD - vfaConsumed,
      sCOD: inf.sCOD - vfaConsumed,
      BOD5: inf.BOD5 * 0.95,
      TKN: inf.TKN,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP + pReleased, // P increases in anaerobic zone
      TSS: inf.TSS,
      VSS: inf.VSS,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: 0, // anaerobic
      temperature: inf.temperature,
    };

    const depth = p.depth ?? 4.5;
    const hrt_h = hrt * 24;
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
          citation: 'Metcalf & Eddy (2014) Ch. 5 — ~5 W/m³ anaerobic mixing',
        },
      ],
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const mixerPrice = getPrice('submersible_mixer_3kw');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Anaerobic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
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
          V: { value: volume, unit: 'm3', source: 'derived (EBPR contact time × Q; delegate overrides for UCT trains)' },
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
        },
        result: { value: hrt_h, unit: 'h' },
        citation: 'Ekama (1984) — typical anaerobic HRT 1-2h for BPR',
      },
      {
        label: 'Phosphorus released by PAOs',
        symbol: 'P_rel',
        equation: 'P_rel = VFA_consumed × p_release_rate',
        inputs: {
          VFA_consumed: { value: vfaConsumed, unit: 'mgCOD/L', source: 'PAO uptake' },
          p_release_rate: { value: pReleaseRate, unit: 'mgP/mgCOD', source: 'user input' },
        },
        result: { value: pReleased, unit: 'mgP/L' },
        citation: 'Wentzel et al. (1990) — UCT BPR model',
      },
    ];
    if (hrt_h < 0.5)
      base.warnings.push(`HRT = ${hrt_h.toFixed(2)}h is very short. Typical anaerobic HRT for BPR is 1-2h.`);

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt_h,
        VFA_consumed: vfaConsumed,
        P_released: pReleased,
      },
      ...base,
    };
  }
}
