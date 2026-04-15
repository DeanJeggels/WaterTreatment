import { expect } from 'vitest';
import type { ProcessResult } from '../../src/types';

/**
 * Assert that a ProcessResult has the 6 v2 extension fields populated
 * (with empty-but-valid defaults during Phase 1a).
 */
export function assertValidV2Outputs(result: ProcessResult): void {
  expect(result.sizing).toBeDefined();
  expect(typeof result.sizing).toBe('object');

  expect(result.energy).toBeDefined();
  expect(result.energy!.installedKW).toBeTypeOf('number');
  expect(result.energy!.dailyKWh).toBeTypeOf('number');
  expect(Array.isArray(result.energy!.records)).toBe(true);

  expect(Array.isArray(result.consumables)).toBe(true);

  expect(result.capex).toBeDefined();
  expect(Array.isArray(result.capex!.lineItems)).toBe(true);
  expect(result.capex!.total).toBeTypeOf('number');

  expect(Array.isArray(result.calculationRecords)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);
}
