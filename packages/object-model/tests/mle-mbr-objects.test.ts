import { describe, it, expect } from 'vitest';
import { designMleMbr, type MleMbrBasis } from '@repo/sim-engine';
import { instantiateMleMbr } from '../src/mle-mbr-objects';
import { engineeringObjectSchema } from '../src/index';

const BASIS: MleMbrBasis = {
  adwfM3d: 70,
  codMgL: 900,
  tminC: 15,
  tmaxC: 25,
  elevationM: 1700,
  nitrogenRemoval: true,
  phosphorusRemoval: false,
  dischargeStandard: 'Special',
  mbrRequired: true,
  membraneModel: 'megavision',
  landUse: 'residential',
};

function objs() {
  return instantiateMleMbr(designMleMbr(BASIS), { flowsheetId: 'fs-1' });
}

describe('instantiateMleMbr (object instantiation)', () => {
  it('every object is schema-valid (class/params coherent)', () => {
    for (const o of objs()) {
      expect(engineeringObjectSchema.safeParse(o).success).toBe(true);
    }
  });

  it('models the MBR as a cassette NESTED inside the aeration tank', () => {
    const all = objs();
    const aeration = all.find((o) => o.label.includes('Aeration tank with MBR'))!;
    const cassette = all.find((o) => o.class === 'membrane')!;
    expect(aeration).toBeDefined();
    expect(cassette).toBeDefined();
    expect(cassette.ext?.parentId).toBe(aeration.id);
    expect(cassette.ext?.insideParent).toBe(true);
    // aeration tank carries the diffuser count + MLSS
    expect(aeration.params.kind).toBe('tank');
    if (aeration.params.kind === 'tank') {
      expect(aeration.params.diffuserCount).toBeGreaterThan(0);
      expect(aeration.params.mlssMgL?.value).toBe(12000);
    }
  });

  it('emits TWO distinct blowers (process air + MBR scour)', () => {
    const blowers = objs().filter((o) => o.class === 'blower');
    expect(blowers).toHaveLength(2);
    const labels = blowers.map((b) => b.label).sort();
    expect(labels).toContain('MBR air scour blower');
    expect(labels).toContain('Process air blower');
  });

  it('includes NaOCl dosing, UV, buffer, anoxic, permeate pump', () => {
    const all = objs();
    const dosing = all.find((o) => o.class === 'dosing_skid')!;
    expect(dosing.params.kind).toBe('dosing_skid');
    if (dosing.params.kind === 'dosing_skid') expect(dosing.params.chemical).toBe('sodium-hypochlorite');
    expect(all.some((o) => o.class === 'disinfection')).toBe(true);
    expect(all.some((o) => o.label.toLowerCase().includes('buffer'))).toBe(true);
    expect(all.some((o) => o.label.toLowerCase().includes('anoxic'))).toBe(true);
    expect(all.some((o) => o.class === 'pump')).toBe(true);
  });

  it('copies sizing verbatim (no re-derivation) and is deterministic', () => {
    const all = objs();
    const cassette = all.find((o) => o.class === 'membrane')!;
    expect(cassette.capacity.membraneArea?.value).toBe(designMleMbr(BASIS).mbr.membraneAreaM2);
    expect(JSON.stringify(objs())).toBe(JSON.stringify(objs()));
  });
});
