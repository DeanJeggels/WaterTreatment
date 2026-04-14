import { expect } from 'vitest';
import type { CalculationRecord } from '../../src/types';
import { isValidCalculationRecord } from '../../src/types';

/**
 * Assert that `records` contains at least one CalculationRecord whose
 * `symbol` or `label` matches `needle` (case-insensitive substring match),
 * AND that the matched record is structurally valid.
 *
 * Returns the matched record for further assertions.
 */
export function assertHasCalculationRecord(
  records: CalculationRecord[] | undefined,
  needle: string,
): CalculationRecord {
  expect(records).toBeDefined();
  expect(Array.isArray(records)).toBe(true);
  const n = needle.toLowerCase();
  const match = records!.find(
    r => r.symbol.toLowerCase().includes(n) || r.label.toLowerCase().includes(n),
  );
  expect(
    match,
    `No calculation record matching "${needle}" found in ${records!.map(r => r.symbol).join(', ')}`,
  ).toBeDefined();
  expect(isValidCalculationRecord(match)).toBe(true);
  expect(match!.citation.length).toBeGreaterThan(0);
  return match!;
}

/** Assert that every record in the list is structurally valid with a non-empty citation */
export function assertAllRecordsValid(records: CalculationRecord[] | undefined): void {
  expect(records).toBeDefined();
  for (const r of records!) {
    expect(isValidCalculationRecord(r), `Invalid record: ${JSON.stringify(r)}`).toBe(true);
    expect(r.citation.length, `Record "${r.symbol}" has empty citation`).toBeGreaterThan(0);
  }
}
