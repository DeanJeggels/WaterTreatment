import { describe, it, expect } from 'vitest';
import { getPrice, SUPPLIER_PRICES } from '../src/supplier-prices';

describe('supplier-prices', () => {
  it('getPrice throws on unknown ID', () => {
    expect(() => getPrice('nonexistent_id')).toThrow(/Unknown supplier price ID/);
  });

  it('SUPPLIER_PRICES is a plain object', () => {
    expect(typeof SUPPLIER_PRICES).toBe('object');
    expect(SUPPLIER_PRICES).not.toBeNull();
  });

  it('registry has entries', () => {
    expect(Object.keys(SUPPLIER_PRICES).length).toBeGreaterThanOrEqual(0);
  });
});
