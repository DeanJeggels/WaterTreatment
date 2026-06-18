/**
 * JSON exporter (T6.1) — the canonical, 3D/BIM-ready serialisation. Validates
 * the package against the published contract, then stringifies it. Because
 * every object carries geometry+placement+ports+material+tag+sourceCalc, this
 * JSON directly feeds a future 3D generator and BIM import. Pure.
 */
import { parseDesignPackage, type DesignPackage } from '@repo/object-model';

/** Validate + serialise. `pretty` (default) emits 2-space indentation. */
export function toJSON(pkg: DesignPackage, pretty = true): string {
  const validated = parseDesignPackage(pkg);
  return JSON.stringify(validated, null, pretty ? 2 : 0);
}
