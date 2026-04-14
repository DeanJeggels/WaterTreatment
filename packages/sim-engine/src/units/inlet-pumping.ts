import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
const PUMP_SMALL_ZAR = 35000;
const PUMP_MEDIUM_ZAR = 65000;
const PUMP_LARGE_ZAR = 95000;
const WET_WELL_ZAR_PER_M3 = 22000;

const parameterSchema: ParameterField[] = [
  { key: 'tdh_m', label: 'Total dynamic head', unit: 'm', min: 3, max: 30, step: 0.5, defaultValue: 10 },
  { key: 'pump_efficiency', label: 'Pump efficiency', unit: '', min: 0.5, max: 0.85, step: 0.05, defaultValue: 0.7 },
  { key: 'peak_factor', label: 'Peak factor', unit: '', min: 1.5, max: 4.0, step: 0.1, defaultValue: 2.5 },
  { key: 'wet_well_hrt_min', label: 'Wet well HRT (avg)', unit: 'min', min: 5, max: 30, step: 1, defaultValue: 10 },
];

export const inletPumpingDefinition: UnitDefinition = {
  type: 'inlet_pumping',
  label: 'Inlet Pumping',
  description: 'Submersible centrifugal wet-well pumping — lift to headworks',
  icon: 'arrow-up',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class InletPumping implements ProcessUnit {
  type = 'inlet_pumping' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const tdh = p.tdh_m ?? 10;
    const eta = Math.max(0.5, Math.min(0.85, p.pump_efficiency ?? 0.7));
    const peakFactor = p.peak_factor ?? 2.5;
    const wetWellHrtMin = p.wet_well_hrt_min ?? 10;

    const q_peak_m3_h = (inf.flow * peakFactor) / 24;
    const rho = 1000;
    const g = 9.81;
    const p_hyd_kW = (q_peak_m3_h * rho * g * tdh) / 3.6e6;
    const installedKW = p_hyd_kW / eta;
    const dailyKWh = installedKW * 24;

    const wetWellVolume = (inf.flow * wetWellHrtMin) / 1440;

    let pumpUnitPrice = PUMP_SMALL_ZAR;
    let pumpDescription = 'Submersible pump 7.5 kW class (Grundfos SE)';
    if (installedKW > 15) {
      pumpUnitPrice = PUMP_LARGE_ZAR;
      pumpDescription = 'Submersible pump 22 kW class (Grundfos SE)';
    } else if (installedKW > 7.5) {
      pumpUnitPrice = PUMP_MEDIUM_ZAR;
      pumpDescription = 'Submersible pump 15 kW class (Grundfos SE)';
    }

    const base = emptyUnitOutputs();
    base.sizing = {
      tdh: { value: tdh, unit: 'm' },
      peakFlow: { value: q_peak_m3_h, unit: 'm3/h' },
      wetWellVolume: { value: wetWellVolume, unit: 'm3' },
    };
    base.energy = {
      installedKW,
      dailyKWh,
      records: [
        {
          label: 'Installed pump power',
          symbol: 'P_inst',
          equation: 'P_inst = Q × ρ × g × H / (3.6e6 × η)',
          inputs: {
            Q: { value: q_peak_m3_h, unit: 'm3/h', source: 'peak flow' },
            H: { value: tdh, unit: 'm', source: 'user input TDH' },
            eta: { value: eta, unit: '', source: 'pump efficiency' },
          },
          result: { value: installedKW, unit: 'kW' },
          citation: 'Grundfos SE range catalogue 2025',
        },
      ],
    };
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Wet well reinforced concrete (${wetWellVolume.toFixed(1)} m³)`,
          quantity: wetWellVolume,
          unit: 'm3',
          unitPriceZar: WET_WELL_ZAR_PER_M3,
          sourceCitation: 'CH-ISE internal estimate 2026',
        },
        {
          category: 'mechanical',
          description: pumpDescription,
          quantity: 2,
          unit: 'ea',
          unitPriceZar: pumpUnitPrice,
          sourceCitation: 'Grundfos SE range SA catalogue 2025',
        },
      ],
      total: wetWellVolume * WET_WELL_ZAR_PER_M3 + 2 * pumpUnitPrice,
    };
    base.calculationRecords = [
      {
        label: 'Pump hydraulic power',
        symbol: 'P_hyd',
        equation: 'P_hyd = Q × ρ × g × H / 3.6e6',
        inputs: {
          Q: { value: q_peak_m3_h, unit: 'm3/h', source: 'peak flow' },
          rho: { value: rho, unit: 'kg/m3', source: 'water' },
          g: { value: g, unit: 'm/s²', source: 'gravity' },
          H: { value: tdh, unit: 'm', source: 'TDH' },
        },
        result: { value: p_hyd_kW, unit: 'kW' },
        citation: 'Metcalf & Eddy (2014) Ch. 5 — pump sizing',
      },
    ];

    return {
      outputs: { out: { ...inf } },
      metadata: { installedKW, peak_flow_m3_h: q_peak_m3_h },
      ...base,
    };
  }
}
