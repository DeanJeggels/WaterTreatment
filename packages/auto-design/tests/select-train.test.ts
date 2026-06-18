import { describe, it, expect } from 'vitest';
import { selectTrain } from '../src/select-train';

describe('selectTrain (T2.1)', () => {
  it('builds the MLE train with P-removal and disinfection', () => {
    const t = selectTrain({ plantType: 'MLE', pRemoval: true, disinfection: true });
    expect(t.mainLine).toEqual([
      'influent',
      'inlet_pumping',
      'screen',
      'grit_removal',
      'equalisation_tank',
      'bioreactor_anoxic',
      'bioreactor_aerobic',
      'chemical_dosing',
      'secondary_clarifier',
      'uv_disinfection',
      'effluent',
    ]);
    expect(t.sludgeLine).toEqual(['thickener', 'dewatering']);
    expect(t.units).toEqual([...t.mainLine, ...t.sludgeLine]);
  });

  it('drops chemical_dosing when P-removal is off', () => {
    const t = selectTrain({ plantType: 'MLE', pRemoval: false });
    expect(t.mainLine).not.toContain('chemical_dosing');
  });

  it('drops uv_disinfection when disinfection is off', () => {
    const t = selectTrain({ plantType: 'MLE', pRemoval: false, disinfection: false });
    expect(t.mainLine).not.toContain('uv_disinfection');
  });

  it('MBR replaces the secondary clarifier with an mbr', () => {
    const t = selectTrain({ plantType: 'MBR', pRemoval: false });
    expect(t.mainLine).toContain('mbr');
    expect(t.mainLine).not.toContain('secondary_clarifier');
  });

  it('throws for unsupported MVP plant types', () => {
    expect(() => selectTrain({ plantType: 'extended_aeration', pRemoval: false })).toThrow(/not supported/);
  });

  it('is deterministic / snapshot-stable', () => {
    expect(selectTrain({ plantType: 'MLE', pRemoval: true })).toEqual(
      selectTrain({ plantType: 'MLE', pRemoval: true }),
    );
  });
});
