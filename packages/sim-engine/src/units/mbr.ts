import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';

const MBR_MODULE_AREA_M2 = 64;
const MBR_DEFAULT_FLUX_LMH = 18.4;
const MBR_OPERATIONAL_FRACTION = 0.8;

const parameterSchema: ParameterField[] = [
  { key: 'flux_lmh', label: 'Design flux', unit: 'L/m²/h', min: 10, max: 30, step: 0.5, defaultValue: 18.4 },
  { key: 'operational_fraction', label: 'Operational fraction', unit: '', min: 0.5, max: 1.0, step: 0.05, defaultValue: 0.8, advanced: true },
  { key: 'module_area_m2', label: 'Module area', unit: 'm²', min: 20, max: 200, step: 1, defaultValue: 64, advanced: true },
];

export const mbrDefinition: UnitDefinition = {
  type: 'mbr',
  label: 'MBR',
  description: 'Membrane filtration module — produces particle-free permeate + reject',
  icon: 'layers',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'permeate', label: 'Permeate', position: 'right', type: 'output' },
    { id: 'reject', label: 'Reject', position: 'bottom', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class MBR implements ProcessUnit {
  type = 'mbr' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { permeate: zero, reject: zero }, metadata: {}, ...emptyUnitOutputs() };
    }

    const flux_lmh = p.flux_lmh ?? MBR_DEFAULT_FLUX_LMH;
    const opFrac = p.operational_fraction ?? MBR_OPERATIONAL_FRACTION;
    const modAreaPer = p.module_area_m2 ?? MBR_MODULE_AREA_M2;

    const flow_L_per_d = inf.flow * 1000;
    const requiredArea = flow_L_per_d / (flux_lmh * 24 * opFrac);
    const moduleCount = Math.max(1, Math.ceil(requiredArea / modAreaPer));
    const installedArea = moduleCount * modAreaPer;

    const airScour_Nm3_h = ((installedArea * 12.5) / 1000) * 60;
    const blowerKW = airScour_Nm3_h * 0.05;

    const permeateFlow = inf.flow * 0.98;
    const rejectFlow = inf.flow * 0.02;

    const permeate: WaterQuality = {
      flow: permeateFlow,
      COD: inf.sCOD + (inf.COD - inf.sCOD) * 0.01,
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * 0.1,
      TKN: inf.NH3N + (inf.TKN - inf.NH3N) * 0.02,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: inf.TP * 0.2,
      TSS: 2,
      VSS: 1.5,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    const reject: WaterQuality = {
      flow: rejectFlow,
      COD: (inf.COD * inf.flow - permeate.COD * permeateFlow) / rejectFlow,
      sCOD: inf.sCOD,
      BOD5: (inf.BOD5 * inf.flow - permeate.BOD5 * permeateFlow) / rejectFlow,
      TKN: (inf.TKN * inf.flow - permeate.TKN * permeateFlow) / rejectFlow,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: (inf.TP * inf.flow - permeate.TP * permeateFlow) / rejectFlow,
      TSS: (inf.TSS * inf.flow - permeate.TSS * permeateFlow) / rejectFlow,
      VSS: (inf.VSS * inf.flow - permeate.VSS * permeateFlow) / rejectFlow,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    const base = emptyUnitOutputs();
    base.sizing = {
      membraneArea: { value: installedArea, unit: 'm2' },
      moduleCount: { value: moduleCount, unit: 'ea' },
      fluxOperational: { value: flux_lmh * opFrac, unit: 'L/m²/h' },
      airScourFlow: { value: airScour_Nm3_h, unit: 'Nm³/hr' },
    };
    base.energy = {
      installedKW: blowerKW,
      dailyKWh: blowerKW * 24,
      records: [
        {
          label: 'Air scour blower power',
          symbol: 'P_scour',
          equation: 'P ≈ Q_air × 0.05',
          inputs: {
            Q_air: { value: airScour_Nm3_h, unit: 'Nm³/hr', source: 'air scour flow' },
          },
          result: { value: blowerKW, unit: 'kW' },
          citation: 'Megavision SMU air scour specification 2025',
        },
      ],
    };
    const modulePrice = getPrice('mbr_smu_module');
    const cipPrice = getPrice('mbr_cip_skid');
    base.capex = {
      lineItems: [
        {
          category: 'mechanical',
          description: `Megavision SMU membrane modules (${moduleCount} × ${modAreaPer} m²)`,
          quantity: moduleCount,
          unit: 'ea',
          unitPriceZar: modulePrice.unitPriceZar,
          sourceCitation: modulePrice.source,
        },
        {
          category: 'mechanical',
          description: 'MBR CIP + permeate pump skid',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: cipPrice.unitPriceZar,
          sourceCitation: cipPrice.source,
        },
      ],
      total: moduleCount * modulePrice.unitPriceZar + cipPrice.unitPriceZar,
    };
    base.calculationRecords = [
      {
        label: 'Required membrane area',
        symbol: 'A',
        equation: 'A = Q / (J × op_frac × 24)',
        inputs: {
          Q: { value: flow_L_per_d, unit: 'L/d', source: 'inlet flow × 1000' },
          J: { value: flux_lmh, unit: 'L/m²/h', source: 'design flux' },
          op_frac: { value: opFrac, unit: '', source: 'duty cycle' },
        },
        result: { value: requiredArea, unit: 'm2' },
        citation: 'Judd (2011) The MBR Book Ch. 3 / WWTP Design.xlsm sheet 7',
      },
      {
        label: 'Air scour demand',
        symbol: 'Q_air',
        equation: 'Q_air = (A × 12.5 / 1000) × 60',
        inputs: {
          A: { value: installedArea, unit: 'm2', source: 'installed membrane area' },
        },
        result: { value: airScour_Nm3_h, unit: 'Nm³/hr' },
        citation: 'Megavision SMU air scour specification 2025',
      },
    ];

    return {
      outputs: { permeate, reject },
      metadata: { module_count: moduleCount, membrane_area: installedArea },
      ...base,
    };
  }
}
