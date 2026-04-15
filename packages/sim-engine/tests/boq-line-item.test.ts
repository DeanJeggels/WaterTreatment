import { describe, it, expect } from 'vitest';
import { isValidBoQLineItem, BOQ_CATEGORIES } from '../src/types/boq-line-item';

describe('BoQLineItem', () => {
  it('exports the 5 valid categories', () => {
    expect(BOQ_CATEGORIES).toEqual([
      'civil', 'mechanical', 'electrical', 'chemicals', 'instrumentation',
    ]);
  });

  it('accepts a valid line item', () => {
    const item = {
      category: 'mechanical',
      description: 'Fine screen 3mm ROTAMAT Ro5',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 450000,
      sourceCitation: 'Huber ROTAMAT quote 2025',
    };
    expect(isValidBoQLineItem(item)).toBe(true);
  });

  it('rejects an item with an unknown category', () => {
    const item = {
      category: 'plumbing',
      description: 'x',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 100,
      sourceCitation: 'x',
    };
    expect(isValidBoQLineItem(item)).toBe(false);
  });

  it('rejects an item missing a source citation', () => {
    const item = {
      category: 'mechanical',
      description: 'x',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 100,
    };
    expect(isValidBoQLineItem(item)).toBe(false);
  });
});
