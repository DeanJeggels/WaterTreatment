import type { Dimension } from './dimension';
import type { CalculationRecord } from './calculation-record';
import type { BoQLineItem } from './boq-line-item';
import type { ConsumableItem } from './consumable-item';

/**
 * The extended engineering outputs of a unit — sizing, energy, consumables,
 * BoQ line items, and the full calculation trail.
 */
export interface UnitOutputs {
  sizing: Record<string, Dimension>;
  energy: {
    installedKW: number;
    dailyKWh: number;
    records: CalculationRecord[];
  };
  consumables: ConsumableItem[];
  capex: {
    lineItems: BoQLineItem[];
    total: number;
  };
  calculationRecords: CalculationRecord[];
  warnings: string[];
}

export function emptyUnitOutputs(): UnitOutputs {
  return {
    sizing: {},
    energy: { installedKW: 0, dailyKWh: 0, records: [] },
    consumables: [],
    capex: { lineItems: [], total: 0 },
    calculationRecords: [],
    warnings: [],
  };
}
