// @repo/layout-engine — rule-based 2D plant layout. Headless, deterministic,
// LLM-free. Reads EngineeringObjects + a site, writes placement back onto the
// objects, and returns a PlantLayout (corridors/bunds/pipes/violations/rules).

import { orderAndBand } from './order-and-band';
import { pack, type SiteSpec } from './pack';
import { zones } from './zones';
import type { EngineeringObject, PlantLayout } from '@repo/object-model';

export { orderAndBand, bandFor } from './order-and-band';
export type { Band, OrderedLayout } from './order-and-band';
export { pack, rectangularSite } from './pack';
export type { SiteSpec, PackResult } from './pack';
export { zones } from './zones';
export type { ZonesResult } from './zones';

/**
 * layout(objects, site) — the centrepiece. Orders the spine, bands, packs +
 * relaxes (writing placement back onto each object), then adds bunds/corridors/
 * pipe routes and returns the assembled PlantLayout. Same input → same output.
 */
export function layout(objects: EngineeringObject[], site: SiteSpec): PlantLayout {
  const ordered = orderAndBand(objects);
  const packResult = pack(ordered, objects, site); // mutates objects[].placement — the writeback
  const zoneResult = zones(objects);
  return {
    siteBoundary: site.boundary,
    corridors: zoneResult.corridors,
    bunds: zoneResult.bunds,
    pipeRoutes: zoneResult.pipeRoutes,
    violations: [...packResult.violations, ...zoneResult.violations],
    rulesApplied: [...packResult.rulesApplied, ...zoneResult.rulesApplied],
  };
}
