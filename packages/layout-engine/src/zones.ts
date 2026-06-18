/**
 * Zones (T4.4): bunding, electrical separation, maintenance/vehicle corridors,
 * and Manhattan pipe routes. Runs after pack() (placements are set). Every
 * decision traces to a named LAYOUT_RULES entry in rulesApplied. Deterministic.
 */
import { LAYOUT_RULES } from '@repo/design-library';
import type {
  EngineeringObject,
  Bund,
  Corridor,
  PipeRoute,
  LayoutViolation,
  RuleApplication,
  Point2D,
} from '@repo/object-model';

const round2 = (x: number): number => Math.round(x * 100) / 100;
const halfX = (o: EngineeringObject): number => o.geometry.footprint.lengthM / 2;
const halfY = (o: EngineeringObject): number => o.geometry.footprint.widthM / 2;

const WET_CLASSES = new Set(['tank', 'reactor', 'clarifier', 'membrane', 'thickener', 'disinfection']);

export interface ZonesResult {
  bunds: Bund[];
  corridors: Corridor[];
  pipeRoutes: PipeRoute[];
  violations: LayoutViolation[];
  rulesApplied: RuleApplication[];
}

function rectAround(o: EngineeringObject, margin: number): Point2D[] {
  const { x, y } = o.placement.location;
  const hx = halfX(o) + margin;
  const hy = halfY(o) + margin;
  return [
    { x: round2(x - hx), y: round2(y - hy) },
    { x: round2(x + hx), y: round2(y - hy) },
    { x: round2(x + hx), y: round2(y + hy) },
    { x: round2(x - hx), y: round2(y + hy) },
  ];
}

function requiresBunding(o: EngineeringObject): boolean {
  return o.class === 'dosing_skid' || (o.params.kind === 'tank' && o.params.bunded === true);
}

function vesselVolume(o: EngineeringObject): number {
  if (o.geometry.capacity) return o.geometry.capacity.value;
  if (o.params.kind === 'dosing_skid') return o.params.storageTankVolumeM3.value;
  return o.capacity.tankVolume?.value ?? o.capacity.volume?.value ?? 0;
}

export function zones(objects: EngineeringObject[]): ZonesResult {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const rulesApplied: RuleApplication[] = [];
  const violations: LayoutViolation[] = [];

  // ---- bunding: dosing/bunded vessels get a bund >= 110% of the largest vessel ----
  const bunds: Bund[] = [];
  for (const o of objects) {
    if (!requiresBunding(o)) continue;
    const vol = vesselVolume(o);
    const capacityM3 = round2(LAYOUT_RULES.bunding.capacityFactor * vol);
    bunds.push({
      id: `bund-${o.id}`,
      servesObjectId: o.id,
      capacityM3,
      polygon: rectAround(o, LAYOUT_RULES.bunding.margin),
    });
    rulesApplied.push({
      rule: 'bunding.capacityFactor',
      objectId: o.id,
      detail: `bund ${capacityM3} m3 >= ${LAYOUT_RULES.bunding.capacityFactor} x ${vol} m3`,
    });
  }

  // ---- electrical separation: shift MCC/electrical away from wet + chemical ----
  for (const e of objects.filter((o) => o.class === 'electrical_room')) {
    enforceSeparation(e, objects, rulesApplied);
  }

  // ---- corridors along the plant edges (maintenance + vehicle) ----
  const corridors = buildCorridors(objects, rulesApplied);

  // ---- Manhattan pipe routes between connected objects ----
  const pipeRoutes: PipeRoute[] = [];
  for (const o of objects) {
    for (const c of o.connections) {
      const target = byId.get(c.toObjectId);
      if (!target) continue;
      const a = o.placement.location;
      const b = target.placement.location;
      pipeRoutes.push({
        id: `pipe-${o.id}-${c.toObjectId}`,
        fromObjectId: o.id,
        fromPort: 'out',
        toObjectId: c.toObjectId,
        toPort: c.toPort,
        medium: c.medium,
        points: [
          { x: round2(a.x), y: round2(a.y) },
          { x: round2(b.x), y: round2(a.y) },
          { x: round2(b.x), y: round2(b.y) },
        ],
      });
    }
  }

  return { bunds, corridors, pipeRoutes, violations, rulesApplied };
}

function yOverlap(a: EngineeringObject, b: EngineeringObject): boolean {
  return Math.abs(a.placement.location.y - b.placement.location.y) < halfY(a) + halfY(b);
}

function enforceSeparation(
  e: EngineeringObject,
  objects: EngineeringObject[],
  rulesApplied: RuleApplication[],
): void {
  const wet = objects.filter((o) => WET_CLASSES.has(o.class));
  const chem = objects.filter((o) => o.class === 'dosing_skid');
  const checks: Array<[EngineeringObject[], number, string]> = [
    [wet, LAYOUT_RULES.separation.electricalToWet, 'separation.electricalToWet'],
    [chem, LAYOUT_RULES.separation.electricalToChemical, 'separation.electricalToChemical'],
  ];

  let moved = true;
  let guard = 0;
  while (moved && guard++ < 200) {
    moved = false;
    for (const [group, threshold] of checks) {
      for (const w of group) {
        if (!yOverlap(e, w)) continue;
        const gapX = Math.abs(e.placement.location.x - w.placement.location.x) - (halfX(e) + halfX(w));
        if (gapX < threshold) {
          e.placement.location.x = round2(w.placement.location.x + halfX(w) + threshold + halfX(e));
          moved = true;
        }
      }
    }
  }
  for (const [, , rule] of checks) rulesApplied.push({ rule, objectId: e.id });
}

function buildCorridors(objects: EngineeringObject[], rulesApplied: RuleApplication[]): Corridor[] {
  if (objects.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const o of objects) {
    minX = Math.min(minX, o.placement.location.x - halfX(o));
    maxX = Math.max(maxX, o.placement.location.x + halfX(o));
    minY = Math.min(minY, o.placement.location.y - halfY(o));
    maxY = Math.max(maxY, o.placement.location.y + halfY(o));
  }
  const cw = LAYOUT_RULES.access.corridorWidth;
  const vw = LAYOUT_RULES.access.vehicleWidth;
  const strip = (y0: number, y1: number): Point2D[] => [
    { x: round2(minX), y: round2(y0) },
    { x: round2(maxX), y: round2(y0) },
    { x: round2(maxX), y: round2(y1) },
    { x: round2(minX), y: round2(y1) },
  ];
  rulesApplied.push({ rule: 'access.corridorWidth' }, { rule: 'access.vehicleWidth' });
  return [
    { id: 'corridor-north', kind: 'maintenance', widthM: cw, polygon: strip(maxY, maxY + cw) },
    { id: 'corridor-south', kind: 'vehicle', widthM: vw, polygon: strip(minY - vw, minY) },
  ];
}
