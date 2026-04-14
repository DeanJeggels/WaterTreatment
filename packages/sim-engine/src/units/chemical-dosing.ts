import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
const METERING_PUMP_ZAR = 28000;
const HDPE_TANK_ZAR_PER_M3 = 17500;

const CHEMICAL_DATA: Record<number, { name: string; price: number; density: number }> = {
  0: { name: 'Alum (Al2(SO4)3)', price: 8, density: 1.32 },
  1: { name: 'Ferric chloride', price: 12, density: 1.42 },
  2: { name: 'Cationic polymer', price: 65, density: 1.0 },
  3: { name: 'Hydrated lime', price: 4, density: 2.24 },
  4: { name: 'Caustic soda (50%)', price: 10, density: 1.52 },
};

const parameterSchema: ParameterField[] = [
  { key: 'chemical_type', label: 'Chemical (0=alum,1=ferric,2=polymer,3=lime,4=NaOH)', unit: '', min: 0, max: 4, step: 1, defaultValue: 0 },
  { key: 'dose_mg_per_L', label: 'Dose', unit: 'mg/L', min: 0, max: 500, step: 1, defaultValue: 30 },
  { key: 'storage_days', label: 'Storage capacity', unit: 'd', min: 3, max: 30, step: 1, defaultValue: 7 },
];

export const chemicalDosingDefinition: UnitDefinition = {
  type: 'chemical_dosing',
  label: 'Chemical Dosing',
  description: 'Metered dosing of coagulant / polymer / pH-adjust chemical',
  icon: 'beaker',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class ChemicalDosing implements ProcessUnit {
  type = 'chemical_dosing' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const chemType = Math.max(0, Math.min(4, Math.round(p.chemical_type ?? 0)));
    const chem = CHEMICAL_DATA[chemType];
    const dose_mg_L = Math.max(0, p.dose_mg_per_L ?? 0);
    const storageDays = Math.max(1, p.storage_days ?? 7);

    const dailyKg = (dose_mg_L * inf.flow) / 1000;
    const tankVolume_m3 = Math.max(0.5, (dailyKg * storageDays) / (chem.density * 1000));

    // WQ effects — coagulants remove P, alkaline chemicals raise pH
    const isCoagulant = chemType === 0 || chemType === 1;
    const isAlkali = chemType === 3 || chemType === 4;
    const pRemoved = isCoagulant ? Math.min(inf.TP, inf.TP * Math.min(0.8, dose_mg_L / 100)) : 0;
    const pHOut = isAlkali ? Math.min(10, inf.pH + dose_mg_L / 100) : inf.pH;

    const output: WaterQuality = {
      ...inf,
      TP: Math.max(0, inf.TP - pRemoved),
      pH: pHOut,
    };

    const base = emptyUnitOutputs();
    base.sizing = {
      tankVolume: { value: tankVolume_m3, unit: 'm3' },
      dailyConsumption: { value: dailyKg, unit: 'kg/d' },
    };
    base.capex = {
      lineItems: [
        {
          category: 'mechanical',
          description: 'Diaphragm metering pump (Grundfos DDA class)',
          quantity: 2,
          unit: 'ea',
          unitPriceZar: METERING_PUMP_ZAR,
          sourceCitation: 'Grundfos SA catalogue 2025',
        },
        {
          category: 'civil',
          description: `HDPE storage tank (${tankVolume_m3.toFixed(1)} m³)`,
          quantity: tankVolume_m3,
          unit: 'm3',
          unitPriceZar: HDPE_TANK_ZAR_PER_M3,
          sourceCitation: 'Typical SA supplier 2025',
        },
      ],
      total: 2 * METERING_PUMP_ZAR + tankVolume_m3 * HDPE_TANK_ZAR_PER_M3,
    };
    base.consumables = [
      {
        item: chem.name,
        daily: dailyKg,
        unit: 'kg/d',
        citation: `SA chemical distributor 2025 — ${chem.price} ZAR/kg`,
      },
    ];
    base.calculationRecords = [
      {
        label: 'Daily dose consumption',
        symbol: 'D',
        equation: 'D = dose × Q / 1000',
        inputs: {
          dose: { value: dose_mg_L, unit: 'mg/L', source: 'user input' },
          Q: { value: inf.flow, unit: 'm3/d', source: 'treated flow' },
        },
        result: { value: dailyKg, unit: 'kg/d' },
        citation: 'Metcalf & Eddy (2014) Ch. 6 — chemical dosing',
      },
      {
        label: 'Bulk storage volume',
        symbol: 'V_tank',
        equation: 'V_tank = D × storage_days / (ρ × 1000)',
        inputs: {
          D: { value: dailyKg, unit: 'kg/d', source: 'daily dose' },
          storage_days: { value: storageDays, unit: 'd', source: 'user input' },
          rho: { value: chem.density, unit: 'kg/L', source: 'chemical density' },
        },
        result: { value: tankVolume_m3, unit: 'm3' },
        citation: 'WISA guideline — 7 d storage typical',
      },
    ];

    return {
      outputs: { out: output },
      metadata: {
        chemical_type: chemType,
        daily_kg: dailyKg,
      },
      ...base,
    };
  }
}
