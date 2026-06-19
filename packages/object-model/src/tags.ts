/**
 * ISA-style, area-based tagging — AAA-NNNN-SS (schema §5). DETERMINISTIC: the
 * same (area, kind, seq) always yields the same tag, so re-running the sim never
 * changes a tag. No AI, no clocks, no randomness.
 *
 *   AAA   class/function mnemonic (BIO, ANX, CLR, BLW, PMP, CDS, …)
 *   NNNN  area*1000 + 100 + seq  (first digit = process area, last two = unit no.)
 *   SS    suffix — 'TK' tank, a duty letter A/B/C for rotating plant, or a code
 */
interface TagSpec {
  mnemonic: string;
  /** 'TK', a fixed code, or 'duty' to emit a redundancy letter (A/B/C…) from seq. */
  suffix: string;
}

const TAG_SPECS: Record<string, TagSpec> = {
  influent: { mnemonic: 'INF', suffix: 'PT' },
  inlet_pumping: { mnemonic: 'PMP', suffix: 'duty' },
  feed_pump: { mnemonic: 'FDP', suffix: 'duty' },
  recirculation_pump: { mnemonic: 'RCP', suffix: 'duty' },
  was_pump: { mnemonic: 'WAS', suffix: 'duty' },
  permeate_pump: { mnemonic: 'PMP', suffix: 'duty' },
  cip_tank: { mnemonic: 'CIP', suffix: 'TK' },
  screen: { mnemonic: 'SCN', suffix: 'SC' },
  grit_removal: { mnemonic: 'GRT', suffix: 'EQ' },
  equalisation_tank: { mnemonic: 'EQ', suffix: 'TK' },
  bioreactor_anoxic: { mnemonic: 'ANX', suffix: 'TK' },
  bioreactor_aerobic: { mnemonic: 'BIO', suffix: 'TK' },
  bioreactor_anaerobic: { mnemonic: 'ANA', suffix: 'TK' },
  secondary_clarifier: { mnemonic: 'CLR', suffix: 'TK' },
  mbr: { mnemonic: 'MBR', suffix: 'TK' },
  uv_disinfection: { mnemonic: 'UV', suffix: 'EQ' },
  effluent: { mnemonic: 'EFF', suffix: 'PT' },
  thickener: { mnemonic: 'THK', suffix: 'TK' },
  dewatering: { mnemonic: 'DWT', suffix: 'EQ' },
  chemical_dosing: { mnemonic: 'CDS', suffix: 'duty' },
  aeration_blower: { mnemonic: 'BLW', suffix: 'duty' },
};

/** Process-area digit: 1 inlet works · 2 biological · 3 chemical/tertiary · 4 sludge · 5 services. */
const PROCESS_AREA: Record<string, number> = {
  influent: 1,
  inlet_pumping: 1,
  feed_pump: 1,
  screen: 1,
  grit_removal: 1,
  equalisation_tank: 1,
  bioreactor_anoxic: 2,
  bioreactor_aerobic: 2,
  bioreactor_anaerobic: 2,
  aeration_blower: 2,
  recirculation_pump: 2,
  chemical_dosing: 3,
  secondary_clarifier: 3,
  mbr: 3,
  permeate_pump: 3,
  cip_tank: 3,
  uv_disinfection: 3,
  effluent: 3,
  thickener: 4,
  was_pump: 4,
  dewatering: 4,
  electrical_room: 5,
  building: 5,
};

export function processAreaFor(kind: string): number {
  return PROCESS_AREA[kind] ?? 5;
}

function dutyLetter(seq: number): string {
  // 1 -> 'A', 2 -> 'B', …; wraps defensively past Z.
  return String.fromCharCode(65 + ((Math.max(1, seq) - 1) % 26));
}

/**
 * Allocate a deterministic ISA tag. `kind` is the unit kind (e.g. unitType);
 * `area` is the process-area digit; `seq` is the 1-based unit number in that area.
 */
export function allocateTag(area: number, kind: string, seq: number, dutySeq?: number): string {
  const spec = TAG_SPECS[kind] ?? { mnemonic: kind.slice(0, 3).toUpperCase().padEnd(3, 'X'), suffix: 'EQ' };
  const nnnn = String(area * 1000 + 100 + seq).padStart(4, '0');
  // The unit NUMBER keeps the area sequence (unique); the duty LETTER enumerates
  // the rotating set (A/B/C…) from a per-kind sequence when supplied.
  const suffix = spec.suffix === 'duty' ? dutyLetter(dutySeq ?? seq) : spec.suffix;
  return `${spec.mnemonic}-${nnnn}-${suffix}`;
}
