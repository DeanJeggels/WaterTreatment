import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';
import { surfaceOverflowRateMph, solidsLoadingRateKgM2h } from '../kernels';

const parameterSchema: ParameterField[] = [
  { key: 'surface_area', label: 'Surface Area', unit: 'm²', min: 50, max: 10000, step: 50, defaultValue: 800 },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 6, step: 0.5, defaultValue: 4.0 },
  { key: 'tss_removal', label: 'TSS Removal', unit: '%', min: 95, max: 99.9, step: 0.1, defaultValue: 99.5 },
  { key: 'uo_ratio', label: 'U/O Ratio', unit: '', min: 0.3, max: 1.5, step: 0.05, defaultValue: 0.75 },
];

export const secondaryClarifierDefinition: UnitDefinition = {
  type: 'secondary_clarifier',
  label: 'Secondary Clarifier',
  description: 'Settling of biological floc — produces clarified effluent + concentrated sludge',
  icon: 'triangle',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'overflow', label: 'Effluent', position: 'right', type: 'output' },
    { id: 'underflow', label: 'RAS/WAS', position: 'bottom', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class SecondaryClarifier implements ProcessUnit {
  type = 'secondary_clarifier' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      const zero = emptyWaterQuality();
      return { outputs: { overflow: zero, underflow: zero }, metadata: {}, ...emptyUnitOutputs() };
    }

    const tssR = (p.tss_removal ?? 99.5) / 100;
    const uoRatio = p.uo_ratio ?? 0.75;
    const surfaceArea = p.surface_area ?? 800;

    const flowOverflow = inf.flow / (1 + uoRatio);
    const flowUnderflow = inf.flow - flowOverflow;

    // Overflow: clarified effluent
    const overflow: WaterQuality = {
      flow: flowOverflow,
      COD: inf.sCOD + (inf.COD - inf.sCOD) * (1 - tssR), // soluble passes + tiny particulate
      sCOD: inf.sCOD,
      BOD5: inf.BOD5 * (1 - tssR * 0.5), // some BOD is particulate
      TKN: inf.NH3N + (inf.TKN - inf.NH3N) * (1 - tssR),
      NH3N: inf.NH3N, // soluble passes
      NO3N: inf.NO3N,
      TP: inf.TP * (1 - tssR * 0.3), // some P is in particulate
      TSS: inf.TSS * (1 - tssR),
      VSS: inf.VSS * (1 - tssR),
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    // Underflow: concentrated sludge
    const underflow: WaterQuality = {
      flow: flowUnderflow,
      COD: (inf.COD * inf.flow - overflow.COD * flowOverflow) / flowUnderflow,
      sCOD: inf.sCOD,
      BOD5: (inf.BOD5 * inf.flow - overflow.BOD5 * flowOverflow) / flowUnderflow,
      TKN: (inf.TKN * inf.flow - overflow.TKN * flowOverflow) / flowUnderflow,
      NH3N: inf.NH3N,
      NO3N: inf.NO3N,
      TP: (inf.TP * inf.flow - overflow.TP * flowOverflow) / flowUnderflow,
      TSS: (inf.TSS * inf.flow - overflow.TSS * flowOverflow) / flowUnderflow,
      VSS: (inf.VSS * inf.flow - overflow.VSS * flowOverflow) / flowUnderflow,
      pH: inf.pH,
      alkalinity: inf.alkalinity,
      DO: inf.DO,
      temperature: inf.temperature,
    };

    const area = surfaceArea;
    const depth = p.depth ?? 4.0;
    const volume = area * depth;
    const q_peak = inf.flow * 1.1;
    const sor_mph = surfaceOverflowRateMph(q_peak, area);          // shared clarifier kernel
    const mlssIn = inf.TSS;
    const totalFlowToClarifier = inf.flow * (1 + uoRatio);
    const slr_kg_m2_h = solidsLoadingRateKgM2h(totalFlowToClarifier, mlssIn, area); // shared clarifier kernel

    const base = emptyUnitOutputs();
    base.sizing = {
      surfaceArea: { value: area, unit: 'm2' },
      depth: { value: depth, unit: 'm' },
      volume: { value: volume, unit: 'm3' },
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const scraperPrice = getPrice('secondary_clarifier_scraper_bridge');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Secondary clarifier reinforced concrete tank (${volume.toFixed(0)} m³)`,
          quantity: volume,
          unit: 'm3',
          unitPriceZar: civilPrice.unitPriceZar,
          sourceCitation: civilPrice.source,
        },
        {
          category: 'mechanical',
          description: 'Secondary clarifier scraper / suction bridge',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: scraperPrice.unitPriceZar,
          sourceCitation: scraperPrice.source,
        },
      ],
      total: volume * civilPrice.unitPriceZar + scraperPrice.unitPriceZar,
    };
    base.calculationRecords = [
      {
        label: 'Surface overflow rate (peak)',
        symbol: 'SOR',
        equation: 'SOR = Q_peak / A',
        inputs: {
          Q_peak: { value: q_peak, unit: 'm3/d', source: 'AWWF = Q × 1.1' },
          A: { value: area, unit: 'm2', source: 'user input' },
        },
        result: { value: sor_mph, unit: 'm/h' },
        citation: 'WRC TT-16/84 — SOR ≤ 1 m/h at peak',
      },
      {
        label: 'Solids loading rate',
        symbol: 'SLR',
        equation: 'SLR = (Q + Q_ras) × MLSS / (A × 24)',
        inputs: {
          Q_total: { value: totalFlowToClarifier, unit: 'm3/d', source: 'feed + RAS' },
          MLSS: { value: mlssIn, unit: 'mg/L', source: 'reactor effluent TSS' },
          A: { value: area, unit: 'm2', source: 'user input' },
        },
        result: { value: slr_kg_m2_h, unit: 'kg/m2/h' },
        citation: 'WRC TT-16/84 — SLR ≤ 6 kg/m²·h',
      },
    ];
    if (sor_mph > 1.0)
      base.warnings.push(
        `SOR = ${sor_mph.toFixed(2)} m/h exceeds 1 m/h at peak. Increase surface area.`,
      );
    if (slr_kg_m2_h > 6.0)
      base.warnings.push(
        `SLR = ${slr_kg_m2_h.toFixed(2)} kg/m²·h exceeds 6 kg/m²·h. Increase surface area.`,
      );

    return {
      outputs: { overflow, underflow },
      metadata: {
        surface_loading_rate: inf.flow / area,
        underflow_TSS: underflow.TSS,
        overflow_TSS: overflow.TSS,
      },
      ...base,
    };
  }
}
