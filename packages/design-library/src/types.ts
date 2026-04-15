/**
 * Categories map 1:1 to the BoQ categories in @repo/sim-engine.
 * Duplicated here (rather than imported) to keep this package free of
 * circular dependencies and usable as a standalone reference library.
 */
export type BoQCategory =
  | 'civil'
  | 'mechanical'
  | 'electrical'
  | 'chemicals'
  | 'instrumentation';

/** A single priced reference item used by unit models to build BoQ line items */
export interface SupplierPriceRef {
  /** Stable snake_case identifier used by unit models to look up the price */
  id: string;
  /** Human-readable description used in BoQ line items */
  description: string;
  /** Unit price in ZAR */
  unitPriceZar: number;
  /** Unit of measure, e.g. 'm3', 'ea', 'kW', 'L/month' */
  unit: string;
  /** Which BoQ category this line item belongs to */
  category: BoQCategory;
  /** Supplier or estimator name, e.g. 'Huber', 'CH-ISE internal' */
  supplier: string;
  /** Full citation string suitable for a BoQ line item's sourceCitation field */
  source: string;
  /** ISO date of the last price update */
  lastUpdated: string;
  /** Optional free-text notes (e.g. 'covers 7.5-22 kW range', 'includes installation') */
  notes?: string;
}
