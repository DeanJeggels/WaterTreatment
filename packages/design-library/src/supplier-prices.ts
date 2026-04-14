import type { SupplierPriceRef } from './types';

/**
 * The canonical AquaSim supplier price registry. Edit this file to update
 * prices — every change is git-reviewable. Phase 3 extracts all inline
 * prices from unit model files into this registry.
 */
export const SUPPLIER_PRICES: Record<string, SupplierPriceRef> = {
  // Entries added in Task 3
};

/**
 * Look up a supplier price by ID. Throws if the ID is unknown — this is
 * intentional: an unknown ID almost always means a typo in a unit model,
 * and a runtime exception surfaces the problem in tests immediately.
 */
export function getPrice(id: string): SupplierPriceRef {
  const entry = SUPPLIER_PRICES[id];
  if (!entry) {
    throw new Error(
      `Unknown supplier price ID: "${id}". Check packages/design-library/src/supplier-prices.ts`,
    );
  }
  return entry;
}

/** Return all prices in a given BoQ category — used by the price library UI */
export function getPricesByCategory(category: SupplierPriceRef['category']): SupplierPriceRef[] {
  return Object.values(SUPPLIER_PRICES).filter(p => p.category === category);
}
