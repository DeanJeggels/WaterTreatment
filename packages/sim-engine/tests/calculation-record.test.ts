import { describe, it, expect } from 'vitest';
import { isValidCalculationRecord } from '../src/types/calculation-record';

describe('CalculationRecord', () => {
  it('accepts a fully-populated valid record', () => {
    const record = {
      label: 'Aerobic volume',
      symbol: 'Va',
      equation: 'Va = Vt × (1 − fxt)',
      inputs: {
        Vt: { value: 250, unit: 'm3', source: 'total reactor volume' },
        fxt: { value: 0.25, unit: '', source: 'selected anoxic fraction' },
      },
      result: { value: 187.5, unit: 'm3' },
      citation: 'Ekama (1984) WRC TT-16/84, eq 4.12',
    };
    expect(isValidCalculationRecord(record)).toBe(true);
  });

  it('rejects a record missing the equation', () => {
    const record = {
      label: 'X',
      symbol: 'x',
      inputs: {},
      result: { value: 0, unit: '' },
      citation: 'nowhere',
    };
    expect(isValidCalculationRecord(record)).toBe(false);
  });

  it('rejects a record missing the citation', () => {
    const record = {
      label: 'X',
      symbol: 'x',
      equation: 'x = 0',
      inputs: {},
      result: { value: 0, unit: '' },
    };
    expect(isValidCalculationRecord(record)).toBe(false);
  });
});
