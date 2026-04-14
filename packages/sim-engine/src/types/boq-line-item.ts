export const BOQ_CATEGORIES = [
  'civil',
  'mechanical',
  'electrical',
  'chemicals',
  'instrumentation',
] as const;

export type BoQCategory = typeof BOQ_CATEGORIES[number];

/** A single line in a Bill of Quantities — one priced item */
export interface BoQLineItem {
  category: BoQCategory;
  description: string;
  quantity: number;
  unit: string;
  unitPriceZar: number;
  sourceCitation: string;
  overrideReason?: string;
}

export function isValidBoQLineItem(item: unknown): item is BoQLineItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    BOQ_CATEGORIES.includes(i.category as BoQCategory) &&
    typeof i.description === 'string' &&
    typeof i.quantity === 'number' &&
    typeof i.unit === 'string' &&
    typeof i.unitPriceZar === 'number' &&
    typeof i.sourceCitation === 'string'
  );
}
