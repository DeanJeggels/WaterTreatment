import { describe, it, expect } from 'vitest';
import { getPrice, getPricesByCategory, SUPPLIER_PRICES } from '../src/supplier-prices';

describe('supplier-prices', () => {
  it('contains at least 25 entries', () => {
    expect(Object.keys(SUPPLIER_PRICES).length).toBeGreaterThanOrEqual(25);
  });

  it('every entry has a non-empty source citation', () => {
    for (const [id, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.source.length, `empty source for ${id}`).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid ISO lastUpdated date', () => {
    for (const [id, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.lastUpdated, `bad lastUpdated for ${id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every entry id matches its registry key', () => {
    for (const [key, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.id).toBe(key);
    }
  });

  it('getPrice returns a known entry', () => {
    const p = getPrice('civil_concrete_reinforced');
    expect(p.unitPriceZar).toBe(18000);
    expect(p.unit).toBe('m3');
    expect(p.category).toBe('civil');
  });

  it('getPrice throws on unknown id', () => {
    expect(() => getPrice('nope')).toThrow(/Unknown supplier price ID/);
  });

  it('getPricesByCategory filters correctly', () => {
    const civil = getPricesByCategory('civil');
    expect(civil.length).toBeGreaterThan(0);
    civil.forEach(p => expect(p.category).toBe('civil'));

    const mech = getPricesByCategory('mechanical');
    expect(mech.length).toBeGreaterThan(5);

    const chem = getPricesByCategory('chemicals');
    expect(chem.length).toBeGreaterThan(0);
  });
});
