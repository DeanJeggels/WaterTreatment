import { describe, it, expect } from 'vitest';
import type { ParameterField } from '../src/types';

describe('ParameterField', () => {
  it('supports an optional advanced flag', () => {
    const field: ParameterField = {
      key: 'kd', label: 'Decay Rate', unit: '1/d',
      min: 0, max: 1, step: 0.01, defaultValue: 0.06,
      advanced: true,
    };
    expect(field.advanced).toBe(true);
  });

  it('treats fields without the flag as essential (undefined)', () => {
    const field: ParameterField = {
      key: 'volume', label: 'Volume', unit: 'm³',
      min: 100, max: 100000, step: 100, defaultValue: 5000,
    };
    expect(field.advanced).toBeUndefined();
  });
});
