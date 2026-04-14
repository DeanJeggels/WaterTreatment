/**
 * A single auditable engineering calculation. Every derived number in a
 * proposal should be rendered from one of these so it can be traced back
 * to an equation, inputs, and a cited reference.
 */
export interface CalculationRecord {
  label: string;
  symbol: string;
  equation: string;
  inputs: Record<string, { value: number; unit: string; source: string }>;
  result: { value: number; unit: string };
  citation: string;
}

export function isValidCalculationRecord(r: unknown): r is CalculationRecord {
  if (typeof r !== 'object' || r === null) return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.label === 'string' &&
    typeof rec.symbol === 'string' &&
    typeof rec.equation === 'string' &&
    typeof rec.inputs === 'object' && rec.inputs !== null &&
    typeof rec.result === 'object' && rec.result !== null &&
    typeof (rec.result as { value: unknown }).value === 'number' &&
    typeof (rec.result as { unit: unknown }).unit === 'string' &&
    typeof rec.citation === 'string'
  );
}
