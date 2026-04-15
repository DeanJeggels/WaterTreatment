import { describe, it, expect } from 'vitest';
import { KINETIC_CONSTANTS, adjustForTemperature } from '../src/kinetic-constants';

describe('kinetic-constants', () => {
  it('defines the standard Marais-Ekama coefficients at 20°C', () => {
    expect(KINETIC_CONSTANTS.muAm20).toBe(0.45);
    expect(KINETIC_CONSTANTS.YH).toBe(0.67);
    expect(KINETIC_CONSTANTS.fH).toBe(0.2);
    expect(KINETIC_CONSTANTS.K2_20).toBe(0.101);
  });

  it('applies Arrhenius temperature correction', () => {
    const mu15 = adjustForTemperature(0.45, 1.123, 15);
    expect(mu15).toBeCloseTo(0.45 * Math.pow(1.123, -5), 3);
  });

  it('every entry has a source citation', () => {
    expect(KINETIC_CONSTANTS.source).toContain('Ekama');
  });
});
