/**
 * optimiseLayout — Stage 5 of the master spec. Generates candidate plant layouts,
 * checks the HARD constraints (invalid if violated), scores the survivors with the
 * weighted soft-objective function (weights set by the client priority), and returns
 * the top-3 ranked options plus the selected (rank-1) placements. Deterministic.
 *
 * Scoring (lower = better):
 *   pipe_length·w_pipe + bends·w_bends + crossings·5·w_crossings
 *     + grouping_penalty·w_grouping + sequence_deviation·w_sequence
 *     + footprint·w_footprint − maintenance_access_bonus·w_access
 */
import type { MleMbrDesign } from '@repo/sim-engine';
import type { EngineeringObject } from '@repo/object-model';
import type { MleMbrInputs, ClientPriority } from './inputs';
import { arrangeMechanicalLayout, type MechLayoutResult } from './mechanical-layout';

export interface LayoutWeights {
  pipe: number; bends: number; crossings: number; grouping: number; sequence: number; footprint: number; access: number;
}
export type AccessRating = 'Poor' | 'Adequate' | 'Good' | 'Excellent';
export interface LayoutMetrics {
  pipeLengthM: number;
  bendCount: number;
  crossingCount: number;
  footprintM2: number;
  footprintAvailableM2: number;
  footprintUsedPct: number;
  maintenanceAccess: AccessRating;
  accessFreeFraction: number;
  groupingPenaltyM: number;
  sequenceDeviationM: number;
}
export interface LayoutCandidate {
  key: string;
  label: string;
  arrangementLogic: string;
  metrics: LayoutMetrics;
  score: number;
  hardViolations: string[];
  valid: boolean;
  tradeoffs: string;
  bestForPriority: string;
  clearanceCompromises: string;
  /** Placements + housing for this candidate (used to apply the selection). */
  objects: EngineeringObject[];
  container?: EngineeringObject;
}
export interface OptimiseResult {
  weights: LayoutWeights;
  candidates: LayoutCandidate[]; // top 3, ranked (best first)
  selected: LayoutCandidate;
  /** Stage-4 installation rules from the selected arrangement. */
  appliedRules: string[];
  /** The selected housing (container/skid), if any. */
  container?: EngineeringObject;
}

const round = (x: number, dp = 1): number => { const f = 10 ** dp; return Math.round(x * f) / f; };
const deepCopy = (objs: EngineeringObject[]): EngineeringObject[] => JSON.parse(JSON.stringify(objs)) as EngineeringObject[];

/** Soft-objective weights (1–10) tuned by the client priority. */
export function weightsFor(priority: ClientPriority): LayoutWeights {
  const w: LayoutWeights = { pipe: 4, bends: 3, crossings: 6, grouping: 5, sequence: 8, footprint: 4, access: 5 };
  switch (priority) {
    case 'lowest_cost': w.pipe = 8; w.bends = 6; break;
    case 'best_access': w.access = 9; break;
    case 'smallest_footprint': w.footprint = 9; break;
    case 'future_expansion': w.access = 8; w.footprint = 2; break; // reserve space, favour spread
  }
  return w;
}

// ---- geometry helpers ----
/** Equipment housed inside a container/skid — its position is owned by the housing, not the site. */
const isInsideContainer = (o: EngineeringObject): boolean => o.ext?.parentContainer !== undefined || o.ext?.parentSkid !== undefined;
/** Inside another object (cassette in tank, submersible in tank, equipment in container) — excluded from site overlap/boundary/metrics. The container/skid shell itself IS counted. */
const isNested = (o: EngineeringObject): boolean =>
  o.ext?.insideParent === true || (o.params.kind === 'pump' && o.params.pumpType === 'submersible') || isInsideContainer(o);
interface Box { cx: number; cy: number; hx: number; hy: number }
function boxOf(o: EngineeringObject): Box {
  const rot = ((o.placement.rotationDeg % 180) + 180) % 180;
  const swap = rot >= 45 && rot < 135;
  const l = o.geometry.footprint.lengthM, wM = o.geometry.footprint.widthM;
  return { cx: o.placement.location.x, cy: o.placement.location.y, hx: (swap ? wM : l) / 2, hy: (swap ? l : wM) / 2 };
}
const overlaps = (a: Box, b: Box, pad = 0): boolean =>
  Math.abs(a.cx - b.cx) < a.hx + b.hx + pad && Math.abs(a.cy - b.cy) < a.hy + b.hy + pad;
function segIntersect(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d = (a: number[], b: number[], c: number[]): number => (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function siteBox(input: MleMbrInputs): { L: number; W: number } {
  if (input.siteBoundary?.length) {
    const xs = input.siteBoundary.map((p) => p.x), ys = input.siteBoundary.map((p) => p.y);
    return { L: Math.max(...xs) - Math.min(...xs), W: Math.max(...ys) - Math.min(...ys) };
  }
  return { L: input.footprintLengthM, W: input.footprintWidthM };
}

function computeMetrics(objects: EngineeringObject[], input: MleMbrInputs): LayoutMetrics {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const placed = objects.filter((o) => !(o.placement.location.x === 0 && o.placement.location.y === 0));
  const { L, W } = siteBox(input);

  // pipe length + bends from connections (Manhattan ≈ orthogonal routing)
  let pipeLengthM = 0, bendCount = 0;
  const segments: number[][][] = [];
  for (const o of objects) {
    for (const c of o.connections) {
      const t = byId.get(c.toObjectId);
      if (!t) continue;
      const dx = Math.abs(o.placement.location.x - t.placement.location.x);
      const dy = Math.abs(o.placement.location.y - t.placement.location.y);
      pipeLengthM += dx + dy;
      if (dx > 0.3 && dy > 0.3) bendCount += 1; // an L-route needs a bend
      segments.push([[o.placement.location.x, o.placement.location.y], [t.placement.location.x, t.placement.location.y]]);
    }
  }
  // crossings
  let crossingCount = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (segIntersect(segments[i]![0]!, segments[i]![1]!, segments[j]![0]!, segments[j]![1]!)) crossingCount += 1;
    }
  }
  // footprint bbox of placed equipment
  const boxes = placed.map(boxOf);
  const minX = Math.min(...boxes.map((b) => b.cx - b.hx)), maxX = Math.max(...boxes.map((b) => b.cx + b.hx));
  const minY = Math.min(...boxes.map((b) => b.cy - b.hy)), maxY = Math.max(...boxes.map((b) => b.cy + b.hy));
  const footprintM2 = Math.max(0, (maxX - minX) * (maxY - minY));
  const footprintAvailableM2 = L * W;

  // maintenance access: fraction of major items whose ≥1000 mm access side is clear
  const major = placed.filter((o) => !isNested(o) && ['tank', 'reactor', 'blower', 'pump', 'dosing_skid', 'disinfection', 'thickener'].includes(o.class));
  const others = placed.filter((o) => !isNested(o));
  let free = 0;
  for (const o of major) {
    const b = boxOf(o);
    const accessBox: Box = { cx: b.cx, cy: b.cy + b.hy + 0.5, hx: b.hx, hy: 0.5 }; // 1 m strip on the N access side
    const blocked = others.some((p) => p.id !== o.id && overlaps(accessBox, boxOf(p)));
    if (!blocked) free += 1;
  }
  const accessFreeFraction = major.length ? free / major.length : 1;
  const maintenanceAccess: AccessRating = accessFreeFraction >= 0.85 ? 'Excellent' : accessFreeFraction >= 0.6 ? 'Good' : accessFreeFraction >= 0.4 ? 'Adequate' : 'Poor';

  // grouping penalty: distance between must-be-close pairs
  const find = (pred: (o: EngineeringObject) => boolean): EngineeringObject | undefined => placed.find(pred);
  const aeration = find((o) => o.params.kind === 'tank' && o.params.function === 'mbr');
  const dist = (a?: EngineeringObject, b?: EngineeringObject): number =>
    a && b ? Math.abs(a.placement.location.x - b.placement.location.x) + Math.abs(a.placement.location.y - b.placement.location.y) : 0;
  const procBlower = find((o) => o.class === 'blower' && /process/i.test(o.label));
  const scourBlower = find((o) => o.class === 'blower' && /scour/i.test(o.label));
  const cip = find((o) => o.class === 'tank' && o.params.kind === 'tank' && o.params.function === 'contact');
  const permeate = find((o) => o.class === 'pump' && o.params.kind === 'pump' && o.params.service === 'permeate');
  const uv = find((o) => o.class === 'disinfection');
  const groupingPenaltyM = dist(procBlower, aeration) + dist(scourBlower, aeration) + dist(cip, aeration) + dist(permeate, aeration) + dist(uv, permeate);

  // sequence deviation: backtracking in x along the process order
  const order = ['equalisation', 'anoxic', 'mbr'].map((fn) => placed.find((o) => o.params.kind === 'tank' && o.params.function === fn))
    .concat([uv]).filter(Boolean) as EngineeringObject[];
  let sequenceDeviationM = 0;
  for (let i = 1; i < order.length; i++) sequenceDeviationM += Math.max(0, order[i - 1]!.placement.location.x - order[i]!.placement.location.x);

  return {
    pipeLengthM: round(pipeLengthM), bendCount, crossingCount,
    footprintM2: round(footprintM2), footprintAvailableM2: round(footprintAvailableM2),
    footprintUsedPct: round((footprintM2 / Math.max(1, footprintAvailableM2)) * 100),
    maintenanceAccess, accessFreeFraction: round(accessFreeFraction, 2),
    groupingPenaltyM: round(groupingPenaltyM), sequenceDeviationM: round(sequenceDeviationM),
  };
}

function hardConstraints(objects: EngineeringObject[], input: MleMbrInputs): string[] {
  const v: string[] = [];
  const { L, W } = siteBox(input);
  const placed = objects.filter((o) => !(o.placement.location.x === 0 && o.placement.location.y === 0));
  // within site boundary (footprint inside 0..L × 0..W, small tolerance)
  for (const o of placed.filter((o) => !isNested(o))) {
    const b = boxOf(o);
    if (b.cx - b.hx < -0.01 || b.cy - b.hy < -0.01 || b.cx + b.hx > L + 0.01 || b.cy + b.hy > W + 0.01) {
      v.push(`${o.mechanical?.equipmentId ?? o.tag} extends outside the site boundary`);
    }
  }
  // no overlap between non-nested footprints (clearance pad 0.3 m)
  const surf = placed.filter((o) => !isNested(o));
  for (let i = 0; i < surf.length; i++) {
    for (let j = i + 1; j < surf.length; j++) {
      if (overlaps(boxOf(surf[i]!), boxOf(surf[j]!), 0.3)) {
        v.push(`${surf[i]!.mechanical?.equipmentId ?? surf[i]!.tag} overlaps ${surf[j]!.mechanical?.equipmentId ?? surf[j]!.tag}`);
      }
    }
  }
  return [...new Set(v)];
}

function scoreLayout(m: LayoutMetrics, w: LayoutWeights): number {
  const accessBonus = m.accessFreeFraction * 100;
  return round(
    m.pipeLengthM * w.pipe + m.bendCount * w.bends + m.crossingCount * 5 * w.crossings +
    m.groupingPenaltyM * w.grouping + m.sequenceDeviationM * w.sequence + m.footprintM2 * w.footprint -
    accessBonus * w.access,
  );
}

// ---- candidate transforms (deterministic geometric variants) ----
/** Compact: pull the tertiary line + plant room toward the array to shrink the bbox. */
function compactTransform(objects: EngineeringObject[]): EngineeringObject[] {
  const tankYs = objects.filter((o) => o.params.kind === 'tank' && ['equalisation', 'anoxic', 'mbr'].includes(o.params.function ?? '')).map((o) => o.placement.location.y);
  const rowY = tankYs.length ? tankYs.reduce((a, b) => a + b, 0) / tankYs.length : 0;
  const aerX = objects.find((o) => o.params.kind === 'tank' && o.params.function === 'mbr')?.placement.location.x ?? 0;
  for (const o of objects) {
    // Container-housed UV/dosing stay in their zone; only free-standing (civil) tertiary folds.
    if ((o.class === 'disinfection' || o.class === 'dosing_skid') && !isInsideContainer(o)) {
      // fold tertiary into a second row just above the tank array (shorter X extent)
      o.placement = { ...o.placement, location: { ...o.placement.location, x: aerX + (o.class === 'dosing_skid' ? 3 : 1.5), y: rowY + 6 } };
    }
  }
  return objects;
}
/** Access: scale spacing outward from the centroid for generous maintenance access. */
function accessTransform(objects: EngineeringObject[]): EngineeringObject[] {
  // Scale free-standing site equipment (tanks + their submersibles move together);
  // never the container/skid shell or its housed equipment (must stay within the envelope).
  const placed = objects.filter((o) => !(o.placement.location.x === 0 && o.placement.location.y === 0) && !o.ext?.insideParent && !isInsideContainer(o) && o.class !== 'building');
  const cx = placed.reduce((s, o) => s + o.placement.location.x, 0) / Math.max(1, placed.length);
  const cy = placed.reduce((s, o) => s + o.placement.location.y, 0) / Math.max(1, placed.length);
  const k = 1.35;
  for (const o of placed) {
    o.placement = { ...o.placement, location: { ...o.placement.location, x: cx + (o.placement.location.x - cx) * k, y: cy + (o.placement.location.y - cy) * k } };
  }
  return objects;
}

const CANDIDATES = [
  { key: 'inline', label: 'In-line process train', logic: 'Tanks in a single process-flow row with the plant room in front; tertiary continues downstream on the line.', tradeoffs: 'Longest pipe run but the cleanest process sequence and fewest crossings.', priority: 'future_expansion', transform: (o: EngineeringObject[]) => o },
  { key: 'compact', label: 'Compact / folded', logic: 'Tertiary (UV + dosing) folded into a second row above the array to shrink the footprint.', tradeoffs: 'Smallest footprint and shortest pipe, at the cost of a tighter maintenance envelope.', priority: 'smallest_footprint', transform: compactTransform },
  { key: 'access', label: 'Spread for access', logic: 'Equipment spacing scaled out from the centroid for full walk-around maintenance access.', tradeoffs: 'Best maintenance access and lowest congestion, but the largest footprint and longest pipe.', priority: 'best_access', transform: accessTransform },
];

export function optimiseLayout(placeable: EngineeringObject[], input: MleMbrInputs, design: MleMbrDesign): OptimiseResult {
  // Base arrangement (Stage 4) on the REAL objects → the in-line strategy.
  const baseMech: MechLayoutResult = arrangeMechanicalLayout(placeable, input, design);
  const baseAll = baseMech.container ? [...placeable, baseMech.container] : [...placeable];
  const weights = weightsFor(input.clientPriority);

  const scored: LayoutCandidate[] = CANDIDATES.map((c) => {
    const objs = c.transform(deepCopy(baseAll));
    const metrics = computeMetrics(objs, input);
    const hardViolations = hardConstraints(objs, input);
    const compromises: string[] = [];
    if (metrics.maintenanceAccess === 'Poor' || metrics.maintenanceAccess === 'Adequate') compromises.push(`maintenance access ${metrics.maintenanceAccess.toLowerCase()} (some 1 m clearances tight)`);
    if (metrics.sequenceDeviationM > 0.5) compromises.push(`${metrics.sequenceDeviationM} m of process backtracking`);
    if (metrics.footprintUsedPct > 90) compromises.push('footprint near the site boundary');
    return {
      key: c.key, label: c.label, arrangementLogic: c.logic, metrics,
      score: scoreLayout(metrics, weights), hardViolations, valid: hardViolations.length === 0,
      tradeoffs: c.tradeoffs, bestForPriority: c.priority,
      clearanceCompromises: compromises.length ? compromises.join('; ') : 'none — all minimum clearances met',
      objects: objs, container: objs.find((o) => o.class === 'building'),
    };
  });

  // Rank valid first (by score asc); fall back to least-violating if none valid.
  const valid = scored.filter((c) => c.valid).sort((a, b) => a.score - b.score);
  const ranked = valid.length ? valid : [...scored].sort((a, b) => a.hardViolations.length - b.hardViolations.length || a.score - b.score);
  const candidates = ranked.slice(0, 3);
  const selected = candidates[0]!;

  // Apply the selected placements back onto the real objects.
  const selById = new Map(selected.objects.map((o) => [o.id, o]));
  for (const o of placeable) {
    const s = selById.get(o.id);
    if (s) { o.placement = s.placement; o.ext = s.ext; }
  }
  const container = baseMech.container ? selById.get(baseMech.container.id) : undefined;

  return { weights, candidates, selected, appliedRules: baseMech.appliedRules, container };
}
