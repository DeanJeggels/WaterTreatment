/**
 * Default material spec per unit kind. DATA, not logic — a reviewable table of
 * sensible SA WWTP defaults the materialiser copies onto each object. Deterministic.
 */
import type { MaterialSpec } from './types';

const WATERTIGHT_RC: MaterialSpec = { primary: 'reinforced-concrete', grade: 'C35/45 W4 watertight' };

const MATERIAL_BY_UNIT: Record<string, MaterialSpec> = {
  influent: { primary: 'reinforced-concrete' },
  inlet_pumping: { primary: 'reinforced-concrete' },
  screen: { primary: 'stainless-304' },
  grit_removal: { primary: 'reinforced-concrete' },
  equalisation_tank: WATERTIGHT_RC,
  bioreactor_anoxic: WATERTIGHT_RC,
  bioreactor_aerobic: WATERTIGHT_RC,
  bioreactor_anaerobic: WATERTIGHT_RC,
  secondary_clarifier: WATERTIGHT_RC,
  mbr: { primary: 'stainless-316' },
  uv_disinfection: { primary: 'stainless-316' },
  effluent: { primary: 'reinforced-concrete' },
  thickener: WATERTIGHT_RC,
  dewatering: { primary: 'stainless-304' },
  chemical_dosing: { primary: 'HDPE', coating: '316SS bund' },
  aeration_blower: { primary: 'carbon-steel', coating: 'painted skid + acoustic hood' },
  feed_pump: { primary: 'stainless-316' },
  recirculation_pump: { primary: 'stainless-316' },
  was_pump: { primary: 'stainless-316' },
  permeate_pump: { primary: 'stainless-316' },
  cip_tank: { primary: 'HDPE', coating: '316SS bund' },
};

export function materialFor(kind: string): MaterialSpec {
  return { ...(MATERIAL_BY_UNIT[kind] ?? { primary: 'carbon-steel' }) };
}
