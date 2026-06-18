/**
 * dimension-deriver — GEOMETRY ONLY. Turns a unit's sized magnitudes (volume,
 * surfaceArea, depth — read VERBATIM from sim-engine, never re-derived) into a
 * bounding footprint + envelope for the layout engine. Every output is a pure
 * geometric transform and is labelled a "layout geometry assumption".
 *
 * It NEVER computes a process quantity: volume/area/depth come in from the
 * frozen engine; only L×W / diameter / freeboard (drawing geometry) come out.
 */
import type { Dimension } from '@repo/sim-engine';
import type { Geometry, ObjectClass } from './types';

export interface DerivedGeometry {
  geometry: Geometry;
  /** Each entry is prefixed "layout geometry assumption:" for the audit trail. */
  notes: string[];
}

/** Circular process units. */
const CIRCULAR_CLASSES = new Set<ObjectClass>(['clarifier', 'thickener']);
/** Rectangular liquid-retaining structures. */
const RECTANGULAR_CLASSES = new Set<ObjectClass>(['tank', 'reactor', 'membrane']);

/** Standard skid/package footprints (m) for equipment without a sized envelope. */
const SKID_FOOTPRINTS: Partial<Record<ObjectClass, { lengthM: number; widthM: number; heightM: number }>> = {
  pump: { lengthM: 2.0, widthM: 1.2, heightM: 1.5 },
  blower: { lengthM: 2.4, widthM: 1.6, heightM: 1.8 },
  dosing_skid: { lengthM: 4.5, widthM: 3.0, heightM: 3.2 },
  screen: { lengthM: 3.0, widthM: 1.5, heightM: 2.0 },
  mixer: { lengthM: 1.5, widthM: 1.5, heightM: 1.5 },
  disinfection: { lengthM: 6.0, widthM: 1.2, heightM: 1.5 },
  dewatering: { lengthM: 5.0, widthM: 3.0, heightM: 2.5 },
  electrical_room: { lengthM: 6.0, widthM: 4.0, heightM: 3.0 },
  building: { lengthM: 8.0, widthM: 6.0, heightM: 3.5 },
};
const DEFAULT_SKID = { lengthM: 3.0, widthM: 3.0, heightM: 2.5 };

const DEFAULT_FREEBOARD_M = 0.5;
const DEFAULT_DEPTH_M = 4.0;
const ASSUMPTION = (s: string) => `layout geometry assumption: ${s}`;

const round2 = (x: number): number => Math.round(x * 100) / 100;
const m = (value: number, unit = 'm'): Dimension => ({ value, unit });

export function deriveGeometry(objectClass: ObjectClass, sizing: Record<string, Dimension>): DerivedGeometry {
  const surfaceArea = sizing.surfaceArea?.value;
  const volume = sizing.volume?.value;
  const depthValue = sizing.depth?.value;
  const notes: string[] = [];

  // ---- circular units (clarifier, thickener) ----
  if (CIRCULAR_CLASSES.has(objectClass) && surfaceArea && surfaceArea > 0) {
    const diameter = round2(Math.sqrt((4 * surfaceArea) / Math.PI));
    const depth = depthValue ?? DEFAULT_DEPTH_M;
    if (depthValue === undefined) notes.push(ASSUMPTION(`side-water depth ${DEFAULT_DEPTH_M} m (not sized)`));
    notes.push(ASSUMPTION(`circular plan Ø${diameter} m from surfaceArea ${surfaceArea} m²`));
    notes.push(ASSUMPTION(`${DEFAULT_FREEBOARD_M} m freeboard added to water depth`));
    return {
      geometry: {
        shape: 'circle',
        footprint: { lengthM: diameter, widthM: diameter },
        diameterM: m(diameter),
        heightM: m(round2(depth + DEFAULT_FREEBOARD_M)),
        freeboardM: m(DEFAULT_FREEBOARD_M),
        capacity: surfaceArea && depthValue ? m(round2(surfaceArea * depth), 'm3') : undefined,
      },
      notes,
    };
  }

  // ---- rectangular liquid-retaining structures (tanks, reactors) ----
  if ((RECTANGULAR_CLASSES.has(objectClass) || volume) && volume && volume > 0) {
    const depth = depthValue ?? DEFAULT_DEPTH_M;
    if (depthValue === undefined) notes.push(ASSUMPTION(`side-water depth ${DEFAULT_DEPTH_M} m (not sized)`));
    const area = volume / depth;
    // 2:1 length:width split of the plan area.
    const lengthM = round2(Math.sqrt(2 * area));
    const widthM = round2(Math.sqrt(area / 2));
    notes.push(ASSUMPTION(`rectangular plan ${lengthM}×${widthM} m (2:1) from volume ${volume} m³ ÷ depth ${depth} m`));
    notes.push(ASSUMPTION(`${DEFAULT_FREEBOARD_M} m freeboard added to water depth`));
    return {
      geometry: {
        shape: 'rectangle',
        footprint: { lengthM, widthM },
        heightM: m(round2(depth + DEFAULT_FREEBOARD_M)),
        freeboardM: m(DEFAULT_FREEBOARD_M),
        capacity: m(volume, 'm3'),
      },
      notes,
    };
  }

  // ---- skid / package equipment (pumps, blowers, dosing, screens, …) ----
  const skid = SKID_FOOTPRINTS[objectClass] ?? DEFAULT_SKID;
  notes.push(ASSUMPTION(`standard ${objectClass} skid footprint ${skid.lengthM}×${skid.widthM} m`));
  return {
    geometry: {
      shape: 'rectangle',
      footprint: { lengthM: skid.lengthM, widthM: skid.widthM },
      heightM: m(skid.heightM),
      capacity: volume ? m(volume, 'm3') : undefined,
    },
    notes,
  };
}
