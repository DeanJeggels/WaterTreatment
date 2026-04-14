import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
const UV_REACTOR_SMALL_ZAR = 285000;
const UV_REACTOR_MEDIUM_ZAR = 650000;
const UV_REACTOR_LARGE_ZAR = 1250000;
const LP_HO_LAMP_KW = 0.25;
const Q_PER_LAMP_M3_D = 200;

const parameterSchema: ParameterField[] = [
  { key: 'required_dose_mj_cm2', label: 'Required dose', unit: 'mJ/cm²', min: 20, max: 100, step: 5, defaultValue: 40 },
];

export const uvDisinfectionDefinition: UnitDefinition = {
  type: 'uv_disinfection',
  label: 'UV Disinfection',
  description: 'Low-pressure high-output UV reactor — final disinfection',
  icon: 'sun',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class UvDisinfection implements ProcessUnit {
  type = 'uv_disinfection' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const dose = p.required_dose_mj_cm2 ?? 40;
    const lampCount = Math.max(1, Math.ceil(inf.flow / Q_PER_LAMP_M3_D));
    const installedKW = lampCount * LP_HO_LAMP_KW;
    const dailyKWh = installedKW * 24;

    let reactorPrice = UV_REACTOR_SMALL_ZAR;
    let reactorDescription = 'LP-HO UV reactor (small, <500 m³/d)';
    if (inf.flow >= 1500) {
      reactorPrice = UV_REACTOR_LARGE_ZAR;
      reactorDescription = 'LP-HO UV reactor (large, 1500-5000 m³/d)';
    } else if (inf.flow >= 500) {
      reactorPrice = UV_REACTOR_MEDIUM_ZAR;
      reactorDescription = 'LP-HO UV reactor (medium, 500-1500 m³/d)';
    }

    const base = emptyUnitOutputs();
    base.sizing = {
      lampCount: { value: lampCount, unit: 'ea' },
      doseDelivered: { value: dose, unit: 'mJ/cm²' },
    };
    base.energy = {
      installedKW,
      dailyKWh,
      records: [
        {
          label: 'UV lamp power',
          symbol: 'P_uv',
          equation: 'P = N_lamps × kW_per_lamp',
          inputs: {
            N_lamps: { value: lampCount, unit: '', source: 'ceil(Q / Q_per_lamp)' },
            kW_per_lamp: { value: LP_HO_LAMP_KW, unit: 'kW', source: 'LP-HO typical' },
          },
          result: { value: installedKW, unit: 'kW' },
          citation: 'Xylem Wedeco catalogue 2025',
        },
      ],
    };
    base.capex = {
      lineItems: [
        {
          category: 'mechanical',
          description: reactorDescription,
          quantity: 1,
          unit: 'ea',
          unitPriceZar: reactorPrice,
          sourceCitation: 'Xylem Wedeco catalogue 2025',
        },
      ],
      total: reactorPrice,
    };
    base.calculationRecords = [
      {
        label: 'Lamp count from flow',
        symbol: 'N',
        equation: 'N = ceil(Q / Q_per_lamp)',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          Q_per_lamp: { value: Q_PER_LAMP_M3_D, unit: 'm3/d', source: 'LP-HO 40 mJ/cm² rating' },
        },
        result: { value: lampCount, unit: 'ea' },
        citation: 'USEPA UVDGM 2006 / Xylem Wedeco sizing',
      },
    ];

    return {
      outputs: { out: { ...inf } },
      metadata: { lamp_count: lampCount },
      ...base,
    };
  }
}
