/**
 * Greedy pack + relax + fit (T4.3). Places the spine left→right at a lane
 * centreline, drops off-spine units into their band near the unit they serve,
 * relaxes footprints to a no-overlap fixpoint, and FIT-checks the bounding box
 * against the site (emitting 'site_area_exceeded' rather than silently
 * overlapping). Deterministic greedy — same input, same placements.
 */
import { LAYOUT_RULES } from '@repo/design-library';
import type { EngineeringObject, LayoutViolation, RuleApplication, Point2D, Placement } from '@repo/object-model';
import type { Band, OrderedLayout } from './order-and-band';

export interface SiteSpec {
  boundary: Point2D[];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;
const halfX = (o: EngineeringObject): number => o.geometry.footprint.lengthM / 2;
const halfY = (o: EngineeringObject): number => o.geometry.footprint.widthM / 2;
const clearanceFor = (o: EngineeringObject): number =>
  LAYOUT_RULES.spacing.byClass[o.class] ?? LAYOUT_RULES.spacing.default;

function zoneFor(o: EngineeringObject): Placement['zone'] {
  switch (o.class) {
    case 'thickener':
    case 'dewatering':
      return 'sludge';
    case 'dosing_skid':
      return 'chemical';
    case 'blower':
      return 'blower';
    case 'electrical_room':
      return 'electrical';
    case 'screen':
      return 'headworks';
    default:
      return 'process';
  }
}

/** Build a rectangular site boundary from an available area. Default aspect is
 *  wide (plants lay out linearly along the flow axis), so the plot is long enough
 *  for the spine rather than near-square. */
export function rectangularSite(areaM2: number, aspect = 2.5): SiteSpec {
  const widthM = Math.sqrt(areaM2 / aspect);
  const lengthM = areaM2 / widthM;
  return {
    boundary: [
      { x: 0, y: 0 },
      { x: round2(lengthM), y: 0 },
      { x: round2(lengthM), y: round2(widthM) },
      { x: 0, y: round2(widthM) },
    ],
  };
}

export interface PackResult {
  violations: LayoutViolation[];
  rulesApplied: RuleApplication[];
}

export function pack(layout: OrderedLayout, objects: EngineeringObject[], site: SiteSpec): PackResult {
  const rulesApplied: RuleApplication[] = [];
  const byId = new Map(objects.map((o) => [o.id, o]));

  // Dynamic band Y so bands never overlap in Y, but never tighter than the rule.
  const maxHalfY = (band: Band): number => {
    const ys = layout.ordered.filter((o) => layout.bandOf.get(o.id) === band).map(halfY);
    return ys.length ? Math.max(...ys) : 0;
  };
  const bandBhalfY = maxHalfY('B');
  const gap = LAYOUT_RULES.spacing.default;
  const bandY: Record<Band, number> = {
    A: round2(Math.max(LAYOUT_RULES.bands.laneOffsetM, bandBhalfY + gap + maxHalfY('A'))),
    B: 0,
    C: round2(-Math.max(LAYOUT_RULES.bands.laneOffsetM, bandBhalfY + gap + maxHalfY('C'))),
  };

  // [1] place the spine left -> right at the band-B centreline.
  let prev: EngineeringObject | undefined;
  const placed = new Set<string>();
  for (const o of layout.spine) {
    let x: number;
    if (!prev) {
      x = halfX(o);
    } else {
      const clr = Math.max(clearanceFor(prev), clearanceFor(o));
      x = prev.placement.location.x + halfX(prev) + clr + halfX(o);
      rulesApplied.push({
        rule: LAYOUT_RULES.spacing.byClass[o.class] !== undefined ? `spacing.byClass.${o.class}` : 'spacing.default',
        objectId: o.id,
      });
    }
    o.placement = { location: { x: round2(x), y: bandY.B, z: 0 }, rotationDeg: 0, zone: zoneFor(o) };
    placed.add(o.id);
    prev = o;
  }

  // [2] drop off-spine units into their band near the unit they serve.
  for (const band of ['A', 'C'] as Band[]) {
    const bandObjs = layout.ordered.filter((o) => layout.bandOf.get(o.id) === band);
    let fallbackX = 0;
    for (const o of bandObjs) {
      const x = neighborX(o, byId, placed) ?? (fallbackX += 8);
      o.placement = { location: { x: round2(x), y: bandY[band], z: 0 }, rotationDeg: 0, zone: zoneFor(o) };
      placed.add(o.id);
    }
  }

  // [3] relax each band along x to a no-overlap fixpoint.
  for (const band of ['A', 'B', 'C'] as Band[]) {
    relaxBand(layout.ordered.filter((o) => layout.bandOf.get(o.id) === band));
  }

  // [4] fit the bounding box inside the site (never silently overlap).
  const violations = fitCheck(objects, site);
  return { violations, rulesApplied };
}

/** x of an already-placed connected neighbour (band-B preferred), or a blower's reactor. */
function neighborX(o: EngineeringObject, byId: Map<string, EngineeringObject>, placed: Set<string>): number | undefined {
  const neighbours = new Set<string>();
  for (const c of o.connections) neighbours.add(c.toObjectId);
  for (const other of byId.values()) {
    if (other.connections.some((c) => c.toObjectId === o.id)) neighbours.add(other.id);
  }
  if (o.id.endsWith('-blower')) neighbours.add(o.id.slice(0, -'-blower'.length));

  let fallback: number | undefined;
  for (const id of neighbours) {
    if (!placed.has(id)) continue;
    const n = byId.get(id);
    if (!n) continue;
    if (n.placement) {
      if (n.geometry) fallback = n.placement.location.x;
    }
  }
  return fallback;
}

function relaxBand(objs: EngineeringObject[]): void {
  const sorted = [...objs].sort((a, b) => a.placement.location.x - b.placement.location.x);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const minGap = halfX(prev) + Math.max(clearanceFor(prev), clearanceFor(cur)) + halfX(cur);
    const needed = round2(prev.placement.location.x + minGap);
    if (cur.placement.location.x < needed) cur.placement.location.x = needed;
  }
}

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function objectsBBox(objects: EngineeringObject[]): BBox {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const o of objects) {
    const { x, y } = o.placement.location;
    minX = Math.min(minX, x - halfX(o));
    maxX = Math.max(maxX, x + halfX(o));
    minY = Math.min(minY, y - halfY(o));
    maxY = Math.max(maxY, y + halfY(o));
  }
  return { minX, maxX, minY, maxY };
}

function boundaryBBox(boundary: Point2D[]): BBox {
  const xs = boundary.map((p) => p.x);
  const ys = boundary.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function fitCheck(objects: EngineeringObject[], site: SiteSpec): LayoutViolation[] {
  if (objects.length === 0) return [];
  const pb = objectsBBox(objects);
  const sb = boundaryBBox(site.boundary);
  const plantW = pb.maxX - pb.minX;
  const plantH = pb.maxY - pb.minY;
  const siteW = sb.maxX - sb.minX;
  const siteH = sb.maxY - sb.minY;
  if (plantW > siteW || plantH > siteH) {
    return [
      {
        code: 'site_area_exceeded',
        severity: 'error',
        message:
          `Plant footprint ${round2(plantW)}×${round2(plantH)} m exceeds the site ` +
          `${round2(siteW)}×${round2(siteH)} m. Consider an MBR train (smaller footprint) or a larger site.`,
        objectIds: [],
      },
    ];
  }
  return [];
}
