import { describe, it, expect } from 'vitest';
import { LAYOUT_RULES } from '../src/layout-rules';

describe('LAYOUT_RULES (T4.1)', () => {
  it('matches the design doc §5 values', () => {
    expect(LAYOUT_RULES.spacing.default).toBe(2.0);
    expect(LAYOUT_RULES.spacing.byClass.clarifier).toBe(3.0);
    expect(LAYOUT_RULES.access.corridorWidth).toBe(3.0);
    expect(LAYOUT_RULES.access.vehicleWidth).toBe(4.5);
    expect(LAYOUT_RULES.bunding.capacityFactor).toBe(1.1);
    expect(LAYOUT_RULES.separation.electricalToWet).toBe(4.0);
    expect(LAYOUT_RULES.separation.electricalToChemical).toBe(5.0);
    expect(LAYOUT_RULES.bands.laneOffsetM).toBe(12.0);
    expect(LAYOUT_RULES.flowAxis).toBe('x');
  });

  it('carries source provenance', () => {
    expect(LAYOUT_RULES.source).toContain('CH-ISE');
  });
});
