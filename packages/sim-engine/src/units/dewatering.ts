import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
const BELT_PRESS_ZAR = 850000;
const CENTRIFUGE_ZAR = 2200000;
const POLYMER_ZAR_PER_KG = 65;
const CAKE_DISPOSAL_ZAR_PER_TONNE = 350;
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;

const parameterSchema: ParameterField[] = [
  { key: 'dewatering_type', label: 'Type (0=belt press, 1=centrifuge)', unit: '', min: 0, max: 1, step: 1, defaultValue: 0 },
  { key: 'polymer_dose_kg_per_tds', label: 'Polymer dose', unit: 'kg/t DS', min: 3, max: 12, step: 0.5, defaultValue: 6 },
  { key: 'cake_solids_pct', label: 'Cake solids override', unit: '%', min: 15, max: 35, step: 1, defaultValue: 0 },
];

export const dewateringDefinition: UnitDefinition = {
  type: 'dewatering',
  label: 'Dewatering',
  description: 'Belt press or decanter centrifuge — produces dewatered cake + filtrate/centrate',
  icon: 'droplet',
  handles: [
    { id: 'in', label: 'Sludge in', position: 'left', type: 'input' },
    { id: 'cake', label: 'Cake', position: 'bottom', type: 'output' },
    { id: 'filtrate', label: 'Filtrate', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Dewatering implements ProcessUnit {
  type = 'dewatering' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { cake: zero, filtrate: zero }, metadata: {}, ...emptyUnitOutputs() };
    }

    const isCentrifuge = (p.dewatering_type ?? 0) >= 0.5;
    const defaultCakePct = isCentrifuge ? 25 : 20;
    const overrideCake = p.cake_solids_pct ?? 0;
    const cakeSolidsPct = overrideCake > 0 ? overrideCake : defaultCakePct;
    const cakeTSS = cakeSolidsPct * 10000;
    const polymerDose = p.polymer_dose_kg_per_tds ?? 6;

    const captureEff = 0.95;
    const solidsIn_kg_d = (inf.TSS * inf.flow) / 1000;
    const solidsToCake_kg_d = solidsIn_kg_d * captureEff;
    const cakeFlow = solidsToCake_kg_d / (cakeTSS / 1000);
    const filtrateFlow = Math.max(0.001, inf.flow - cakeFlow);

    const cake: WaterQuality = {
      flow: cakeFlow,
      COD: inf.COD * (cakeTSS / Math.max(1, inf.TSS)),
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (cakeTSS / Math.max(1, inf.TSS)) * 0.5,
      TKN: inf.TKN * 0.6,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP * 0.6,
      TSS: cakeTSS,
      VSS: cakeTSS * 0.75,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: 0,
      temperature: inf.temperature,
    };

    const filtrate: WaterQuality = {
      flow: filtrateFlow,
      COD: inf.sCOD + (inf.COD - inf.sCOD) * (1 - captureEff),
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (1 - captureEff * 0.8),
      TKN: inf.NH3N + (inf.TKN - inf.NH3N) * (1 - captureEff),
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP * (1 - captureEff * 0.5),
      TSS: inf.TSS * (1 - captureEff),
      VSS: inf.VSS * (1 - captureEff),
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    const polymerDaily_kg = (solidsToCake_kg_d / 1000) * polymerDose;
    const cakeDaily_tonne = solidsToCake_kg_d / 1000;

    const base = emptyUnitOutputs();
    base.sizing = {
      solidsLoad: { value: solidsIn_kg_d, unit: 'kg/d' },
      cakeSolids: { value: cakeSolidsPct, unit: '%' },
    };
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: 'Dewatering building civils',
          quantity: 40,
          unit: 'm3',
          unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
          sourceCitation: 'CH-ISE internal estimate 2026',
        },
        {
          category: 'mechanical',
          description: isCentrifuge
            ? 'Decanter centrifuge 5 m³/h (Alfa Laval class)'
            : 'Belt press 1 m (Andritz SMX class)',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: isCentrifuge ? CENTRIFUGE_ZAR : BELT_PRESS_ZAR,
          sourceCitation: isCentrifuge
            ? 'Alfa Laval catalogue 2024'
            : 'Andritz SMX catalogue 2024',
        },
      ],
      total: 40 * CIVIL_CONCRETE_ZAR_PER_M3 + (isCentrifuge ? CENTRIFUGE_ZAR : BELT_PRESS_ZAR),
    };
    base.consumables = [
      {
        item: 'Cationic polymer',
        daily: polymerDaily_kg,
        unit: 'kg/d',
        citation: `Grundfos / SNF 2025 — ${POLYMER_ZAR_PER_KG} ZAR/kg dry polymer`,
      },
      {
        item: 'Cake disposal to landfill',
        daily: cakeDaily_tonne,
        unit: 't DS/d',
        citation: `Typical SA landfill tipping 2025 — ${CAKE_DISPOSAL_ZAR_PER_TONNE} ZAR/t`,
      },
    ];
    base.calculationRecords = [
      {
        label: 'Dry solids loading',
        symbol: 'DS',
        equation: 'DS = Q × TSS / 1000',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet sludge flow' },
          TSS: { value: inf.TSS, unit: 'mg/L', source: 'inlet TSS' },
        },
        result: { value: solidsIn_kg_d, unit: 'kg/d' },
        citation: 'Metcalf & Eddy (2014) Ch. 14',
      },
      {
        label: 'Polymer consumption',
        symbol: 'D_poly',
        equation: 'D_poly = (DS/1000) × dose',
        inputs: {
          DS: { value: solidsToCake_kg_d, unit: 'kg/d', source: 'DS captured' },
          dose: { value: polymerDose, unit: 'kg/t DS', source: 'user input' },
        },
        result: { value: polymerDaily_kg, unit: 'kg/d' },
        citation: 'Metcalf & Eddy (2014) Ch. 14 — polymer 4-8 kg/t typical',
      },
    ];

    return {
      outputs: { cake, filtrate },
      metadata: {
        cake_solids_pct: cakeSolidsPct,
        polymer_kg_per_day: polymerDaily_kg,
      },
      ...base,
    };
  }
}
