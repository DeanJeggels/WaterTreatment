import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';
import {
  fractionateCod, kineticsAtT, denitrificationRateK2, denitrificationPotential,
  denitrifiedNitrate, COD_PER_NO3N,
} from '../kernels';

const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;
const ALK_RECOVERY_PER_NO3N = 3.57; // mg CaCO3 recovered per mgNO3-N denitrified

/** Block-level Marais-Ekama constants (registry entry defaults). */
const DEFAULTS = {
  srt: 15, anoxicFraction: 0.25,
  muAm20: 0.45, Kn20: 1, bA20: 0.04, YH: 0.67, fcv: 1.481, bH20: 0.24,
  fSup: 0.15, fSus: 0.06, K2_20: 0.101,
} as const;

const parameterSchema: ParameterField[] = [
  { key: 'srt', label: 'SRT', unit: 'days', min: 3, max: 40, step: 1, defaultValue: DEFAULTS.srt, description: 'Solids Retention Time (sludge age)' },
  { key: 'anoxic_fraction', label: 'Anoxic mass fraction', unit: '', min: 0.05, max: 0.6, step: 0.05, defaultValue: DEFAULTS.anoxicFraction, description: 'Fraction of reactor mass that is anoxic' },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5, advanced: true },
];

export const bioreactorAnoxicDefinition: UnitDefinition = {
  type: 'bioreactor_anoxic',
  label: 'Anoxic Bioreactor',
  description: 'Denitrification (NO₃ → N₂) using COD as electron donor, Marais-Ekama K2 kinetics',
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

    const srt = p.srt ?? DEFAULTS.srt;
    const fxt = p.anoxic_fraction ?? DEFAULTS.anoxicFraction;
    const depth = p.depth ?? 4.5;
    const T = inf.temperature;

    // ── Denitrification kinetics from Marais-Ekama (sheet 4 Dp1), temperature-corrected K2 ──
    const codFilteredFraction = inf.COD > 0 ? Math.min(1, inf.sCOD / inf.COD) : 0.29;
    const frac = fractionateCod(inf.COD, { fSup: DEFAULTS.fSup, fSus: DEFAULTS.fSus, codFilteredFraction });
    const kin = kineticsAtT(
      { muAm20: DEFAULTS.muAm20, Kn20: DEFAULTS.Kn20, bA20: DEFAULTS.bA20, YH: DEFAULTS.YH, fcv: DEFAULTS.fcv, bH20: DEFAULTS.bH20 },
      T, srt,
    );
    const K2T = denitrificationRateK2(T, DEFAULTS.K2_20);
    const Dp1 = denitrificationPotential(
      { CODbi: frac.totalBiodegradable, fSbs: frac.fSbs, fxt, srtDays: srt },
      { Yhv: kin.Yhv, bHT: kin.bHT }, K2T, { fcv: DEFAULTS.fcv },
    );

    // ── Self-sized anoxic volume ──
    // Volume needed to denitrify the incoming nitrate load at the kinetic rate
    // K2T × MLVSS (Metcalf & Eddy / WRC denitrification-rate sizing). The mixed-
    // liquor VSS is what arrives on the RAS/IMLR recycle. `volume` is an optional
    // manual override (0 = auto-size).
    const mlvss = Math.max(1, inf.VSS);
    const no3LoadGperD = inf.NO3N * inf.flow;          // (mg/L)(m3/d) = gN/d
    const requiredVolume = no3LoadGperD > 0 ? no3LoadGperD / (K2T * mlvss) : 0;
    // Volume is always DERIVED (never a stored input). For a recognised MLE/MBR train
    // the simulation store overrides this with the coupled whole-reactor design.
    const volume = Math.max(50, requiredVolume);
    const hrt = volume / inf.flow;
    const hrt_h = hrt * 24;

    // Denitrification achieved is bounded by the denitrification potential and the
    // electron-donor (biodegradable COD) stoichiometry, 2.86 mgCOD/mgN.
    const codLimit = frac.totalBiodegradable / COD_PER_NO3N;
    const capacity = Math.min(Dp1, codLimit);
    const no3Removed = denitrifiedNitrate(inf.NO3N, capacity); // capacity- and NO3-limited
    const codConsumed = COD_PER_NO3N * no3Removed;

    const no3Out = Math.max(0, inf.NO3N - no3Removed); // removed N leaves as N2 gas
    const sCODOut = Math.max(0, inf.sCOD - codConsumed);
    const codOut = Math.max(0, inf.COD - codConsumed);
    const alkRecoveredMgL = ALK_RECOVERY_PER_NO3N * no3Removed;
    const alkOut = inf.alkalinity + alkRecoveredMgL / 50; // back to mmol/L

    const output: WaterQuality = {
      flow: inf.flow,
      COD: codOut,
      sCOD: sCODOut,
      BOD5: Math.max(0, inf.BOD5 - codConsumed * 0.4),
      TKN: inf.TKN,   // no nitrification here
      NH3N: inf.NH3N,
      NO3N: no3Out,
      TP: inf.TP,
      TSS: inf.TSS,
      VSS: inf.VSS,
      pH: inf.pH,
      alkalinity: alkOut,
      DO: 0, // anoxic
      temperature: T,
    };

    const mixerCount = Math.max(1, Math.ceil(volume / MIXER_VOLUME_PER_UNIT_M3));
    const installedKW = mixerCount * MIXER_KW_PER_UNIT;
    const dailyKWh = installedKW * 24;

    const base = emptyUnitOutputs();
    base.sizing = {
      volume: { value: volume, unit: 'm3' },
      requiredVolume: { value: requiredVolume, unit: 'm3' },
      depth: { value: depth, unit: 'm' },
      HRT: { value: hrt_h, unit: 'h' },
      denitrificationPotential: { value: Dp1, unit: 'mgN/L' },
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
        label: 'Required anoxic volume',
        symbol: 'Vax',
        equation: 'Vax = (NO3-N load) / (K2T × MLVSS)',
        inputs: {
          NO3_load: { value: no3LoadGperD, unit: 'gN/d', source: 'recycle-fed nitrate' },
          K2T: { value: K2T, unit: 'mgN/mgVSS·d', source: `K2,20 × 1.08^(T−20) @ ${T.toFixed(0)}°C` },
          MLVSS: { value: mlvss, unit: 'mg/L', source: 'mixed-liquor VSS (recycle-fed)' },
        },
        result: { value: requiredVolume, unit: 'm3' },
        citation: 'Metcalf & Eddy (2014) / WRC TT-16/84 — denitrification-rate sizing',
      },
      {
        label: 'Denitrification potential',
        symbol: 'Dp1',
        equation: 'Dp1 = CODbi × ( fSbs(1−fcv·Yhv)/2.86 + K2T·fxt·Yhv·Rs/(1+bHT·Rs) )',
        inputs: {
          CODbi: { value: frac.totalBiodegradable, unit: 'mgCOD/L', source: 'biodegradable COD' },
          K2T: { value: K2T, unit: 'mgN/mgVSS·d', source: `K2,20 × 1.08^(T−20) @ ${T.toFixed(0)}°C` },
          fxt: { value: fxt, unit: '', source: 'anoxic mass fraction' },
        },
        result: { value: Dp1, unit: 'mgN/L' },
        citation: 'WWTP Design.xlsm sheet 4 C55 (Ekama 1984, WRC TT-16/84)',
      },
      {
        label: 'Nitrate denitrified',
        symbol: 'ΔNO3',
        equation: 'ΔNO3 = min(NO3_in, Dp1, CODbi/2.86)',
        inputs: {
          NO3_in: { value: inf.NO3N, unit: 'mgN/L', source: 'inlet (recycle-fed)' },
          capacity: { value: capacity, unit: 'mgN/L', source: 'min(Dp1, COD stoichiometric)' },
        },
        result: { value: no3Removed, unit: 'mgN/L' },
        citation: 'WWTP Design.xlsm sheet 4',
      },
    ];
    if (capacity < inf.NO3N) {
      base.warnings.push(`Denitrification COD/capacity-limited: only ${no3Removed.toFixed(1)} of ${inf.NO3N.toFixed(1)} mgNO3-N/L removed. Add carbon or anoxic volume.`);
    }

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt_h,
        NO3_removed: no3Removed,
        denitrificationPotential: Dp1,
        COD_consumed_denitrification: codConsumed,
        alkalinity_recovered: alkRecoveredMgL,
      },
      ...base,
    };
  }
}
