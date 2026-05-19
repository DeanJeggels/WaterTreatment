import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

// Diffuser density rule of thumb: ~1 diffuser per 3 m³ reactor volume (fine bubble grid)
const DIFFUSER_PER_M3 = 1 / 3;

const parameterSchema: ParameterField[] = [
  { key: 'volume', label: 'Volume', unit: 'm³', min: 100, max: 100000, step: 100, defaultValue: 5000 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: 4.5 },
  { key: 'do_setpoint', label: 'DO Setpoint', unit: 'mg/L', min: 0.5, max: 6, step: 0.1, defaultValue: 2.0 },
  { key: 'srt', label: 'SRT', unit: 'days', min: 3, max: 40, step: 1, defaultValue: 12, description: 'Solids Retention Time' },
  { key: 'yield_obs', label: 'Observed Yield', unit: 'gVSS/gCOD', min: 0.2, max: 0.8, step: 0.05, defaultValue: 0.45 },
  { key: 'nitrification_eff', label: 'Nitrification Efficiency', unit: '%', min: 0, max: 100, step: 5, defaultValue: 95 },
  { key: 'cod_removal_eff', label: 'Soluble COD Removal', unit: '%', min: 70, max: 99, step: 1, defaultValue: 90 },
  { key: 'bod_removal_eff', label: 'BOD Removal', unit: '%', min: 80, max: 99, step: 1, defaultValue: 95 },
  { key: 'kd', label: 'Decay Rate', unit: '1/d', min: 0.02, max: 0.15, step: 0.01, defaultValue: 0.06 },
  { key: 'imlr_ratio', label: 'IMLR Ratio (a)', unit: '× Q_in', min: 0, max: 8, step: 0.5, defaultValue: 4, description: 'Internal mixed liquor recycle from aerobic back to anoxic. 4× is typical for BNR. Set to 0 to disable.' },
];

export const bioreactorAerobicDefinition: UnitDefinition = {
  type: 'bioreactor_aerobic',
  label: 'Aerobic Bioreactor',
  description: 'Biological COD removal and nitrification (NH₃ → NO₃)',
  icon: 'wind',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
    { id: 'imlr', label: 'IMLR (recycle)', position: 'top', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class BioreactorAerobic implements ProcessUnit {
  type = 'bioreactor_aerobic' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const volume = p.volume ?? 5000;
    const srt = p.srt ?? 12;
    const yObs = p.yield_obs ?? 0.45;
    const kd = p.kd ?? 0.06;
    const nitrEff = (p.nitrification_eff ?? 95) / 100;
    const codRemEff = (p.cod_removal_eff ?? 90) / 100;
    const bodRemEff = (p.bod_removal_eff ?? 95) / 100;
    const doSetpoint = p.do_setpoint ?? 2.0;

    const hrt = volume / inf.flow; // days

    // COD removal
    const sCOD_removed = inf.sCOD * codRemEff;
    const sCOD_eff = inf.sCOD - sCOD_removed;

    // Biomass production
    const biomassProduced = yObs * sCOD_removed / (1 + kd * srt); // mg/L basis relative to reactor
    const mlss = biomassProduced * srt / hrt;
    const mlvss = mlss * 0.8;

    // Nitrification
    const minSrtForNitrification = 3; // days, simplified
    const canNitrify = srt > minSrtForNitrification && doSetpoint >= 1.0;
    const nh3Oxidized = canNitrify ? inf.NH3N * nitrEff : 0;
    const nh3Out = inf.NH3N - nh3Oxidized;
    const no3Out = inf.NO3N + nh3Oxidized;

    // Alkalinity consumption by nitrification: 7.14 mg CaCO3/mg NH3-N = 0.1428 mmol/L per mgN/L
    const alkConsumed = nh3Oxidized * 7.14 / 50; // mmol/L
    const alkOut = Math.max(0, inf.alkalinity - alkConsumed);

    // BOD removal
    const bod5Out = inf.BOD5 * (1 - bodRemEff);

    // Particulate COD from biomass in effluent (carried out with MLSS)
    const pCOD_biomass = mlss * 1.42; // COD equivalent of biomass
    const totalCOD_out = sCOD_eff + (inf.COD - inf.sCOD) * (1 - codRemEff * 0.5);

    // Oxygen demand
    const o2Carbonaceous = sCOD_removed - 1.42 * biomassProduced;
    const o2Nitrification = 4.57 * nh3Oxidized;

    // TKN: reduced by nitrification + biomass assimilation
    const nAssimilated = biomassProduced * 0.12; // ~12% N content in biomass
    const tknOut = inf.TKN - nh3Oxidized - nAssimilated;

    // TP: some uptake into biomass
    const pAssimilated = biomassProduced * 0.02; // ~2% P content in biomass
    const tpOut = Math.max(0, inf.TP - pAssimilated);

    const output: WaterQuality = {
      flow: inf.flow,
      COD: Math.max(0, totalCOD_out),
      sCOD: Math.max(0, sCOD_eff),
      BOD5: Math.max(0, bod5Out),
      TKN: Math.max(0, tknOut),
      NH3N: Math.max(0, nh3Out),
      NO3N: Math.max(0, no3Out),
      TP: Math.max(0, tpOut),
      TSS: mlss, // reactor effluent carries MLSS to clarifier
      VSS: mlvss,
      pH: alkOut < 1 ? Math.max(6.0, inf.pH - 0.5) : inf.pH,
      alkalinity: alkOut,
      DO: doSetpoint,
      temperature: inf.temperature,
    };

    const imlrRatio = p.imlr_ratio ?? 4;
    const imlr: WaterQuality = { ...output, flow: inf.flow * imlrRatio };

    const depth = p.depth ?? 4.5;
    const o2TotalKgPerD = ((Math.max(0, o2Carbonaceous) + o2Nitrification) * inf.flow) / 1000;
    const diffuserCount = Math.ceil(volume * DIFFUSER_PER_M3);

    const base = emptyUnitOutputs();
    base.sizing = {
      volume: { value: volume, unit: 'm3' },
      depth: { value: depth, unit: 'm' },
      HRT: { value: hrt * 24, unit: 'h' },
      MLSS: { value: mlss, unit: 'mg/L' },
    };
    base.energy = {
      installedKW: 0,
      dailyKWh: 0,
      records: [
        {
          label: 'Total O2 demand',
          symbol: 'FOt',
          equation: 'FOt = (FOc + FOn − FOdn) × Q / 1000',
          inputs: {
            FOc: { value: Math.max(0, o2Carbonaceous), unit: 'mgO/L', source: 'carbonaceous' },
            FOn: { value: o2Nitrification, unit: 'mgO/L', source: 'nitrification' },
            Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          },
          result: { value: o2TotalKgPerD, unit: 'kgO2/d' },
          citation: 'Ekama (1984) WRC TT-16/84, eq 4.23',
        },
      ],
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const diffuserPrice = getPrice('fine_bubble_diffuser_edi_9in');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Aerobic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
          quantity: volume,
          unit: 'm3',
          unitPriceZar: civilPrice.unitPriceZar,
          sourceCitation: civilPrice.source,
        },
        {
          category: 'mechanical',
          description: `9" fine bubble diffusers (EDI FlexAir) × ${diffuserCount}`,
          quantity: diffuserCount,
          unit: 'ea',
          unitPriceZar: diffuserPrice.unitPriceZar,
          sourceCitation: diffuserPrice.source,
        },
      ],
      total: volume * civilPrice.unitPriceZar + diffuserCount * diffuserPrice.unitPriceZar,
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
        result: { value: hrt * 24, unit: 'h' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.1',
      },
      {
        label: 'Mixed liquor suspended solids',
        symbol: 'MLSS',
        equation: 'MLSS = Y_obs × sCOD_removed × SRT / HRT',
        inputs: {
          Y_obs: { value: yObs, unit: 'mgVSS/mgCOD', source: 'user input' },
          sCOD_removed: { value: sCOD_removed, unit: 'mg/L', source: 'biodegradation' },
          SRT: { value: srt, unit: 'd', source: 'user input' },
          HRT: { value: hrt, unit: 'd', source: 'V/Q' },
        },
        result: { value: mlss, unit: 'mg/L' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.8',
      },
      {
        label: 'Carbonaceous O2 demand',
        symbol: 'FOc',
        equation: 'FOc = sCOD_rem − 1.42 × biomass_produced',
        inputs: {
          sCOD_rem: { value: sCOD_removed, unit: 'mg/L', source: 'biodegradation' },
          biomass: { value: biomassProduced, unit: 'mg/L', source: 'Y × sCOD / (1 + kd·SRT)' },
        },
        result: { value: Math.max(0, o2Carbonaceous), unit: 'mgO/L' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.22',
      },
      {
        label: 'Nitrification O2 demand',
        symbol: 'FOn',
        equation: 'FOn = 4.57 × NH3_oxidised',
        inputs: {
          NH3_ox: { value: nh3Oxidized, unit: 'mgN/L', source: 'nitrification' },
        },
        result: { value: o2Nitrification, unit: 'mgO/L' },
        citation: 'Ekama (1984) WRC TT-16/84, eq 4.21',
      },
    ];
    if (mlss > 6000) base.warnings.push(`MLSS = ${mlss.toFixed(0)} mg/L > 6000. Consider MBR or more volume.`);
    if (mlss < 2000) base.warnings.push(`MLSS = ${mlss.toFixed(0)} mg/L < 2000. Reactor may be underloaded.`);

    return {
      outputs: { out: output, imlr },
      metadata: {
        HRT_hours: hrt * 24,
        SRT_days: srt,
        MLSS: mlss,
        MLVSS: mlvss,
        O2_demand_carbonaceous: Math.max(0, o2Carbonaceous),
        O2_demand_nitrification: o2Nitrification,
        O2_demand_total: Math.max(0, o2Carbonaceous) + o2Nitrification,
        biomass_produced: biomassProduced,
        NH3_oxidized: nh3Oxidized,
        IMLR_ratio: imlrRatio,
        IMLR_flow: inf.flow * imlrRatio,
      },
      ...base,
    };
  }
}
