import { SCHEMA_VERSION, type EngineeringObject, type ObjectClass } from '@repo/object-model';

export interface MakeOpts {
  lengthM?: number;
  widthM?: number;
  connectsTo?: string[];
  capacityM3?: number;
}

/** Minimal valid EngineeringObject for layout tests (equipment params = coherent on any class). */
export function makeObject(id: string, klass: ObjectClass, opts: MakeOpts = {}): EngineeringObject {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    tag: id.toUpperCase(),
    class: klass,
    discipline: klass === 'electrical_room' ? 'electrical' : 'process',
    label: id,
    geometry: {
      shape: 'rectangle',
      footprint: { lengthM: opts.lengthM ?? 6, widthM: opts.widthM ?? 4 },
      capacity: opts.capacityM3 !== undefined ? { value: opts.capacityM3, unit: 'm3' } : undefined,
    },
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 },
    material: { primary: 'reinforced-concrete' },
    capacity: {},
    params: { kind: 'equipment', equipmentType: 'other' },
    ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }],
    connections: (opts.connectsTo ?? []).map((t) => ({ toObjectId: t, toPort: 'in', medium: 'water' as const })),
    designNotes: [],
  };
}

/** A small MLE-like object set: headworks -> bio -> clarifier -> uv, + sludge + blower + dosing. */
export function mleObjects(): EngineeringObject[] {
  return [
    makeObject('screen', 'screen', { lengthM: 3, widthM: 1.5, connectsTo: ['anoxic'] }),
    makeObject('anoxic', 'reactor', { lengthM: 20, widthM: 10, connectsTo: ['aerobic'] }),
    makeObject('aerobic', 'reactor', { lengthM: 30, widthM: 15, connectsTo: ['dosing'] }),
    makeObject('dosing', 'dosing_skid', { lengthM: 4.5, widthM: 3, connectsTo: ['clarifier'], capacityM3: 15 }),
    makeObject('clarifier', 'clarifier', { lengthM: 28, widthM: 28, connectsTo: ['uv', 'thickener'] }),
    makeObject('uv', 'disinfection', { lengthM: 6, widthM: 1.2 }),
    makeObject('thickener', 'thickener', { lengthM: 12, widthM: 12, connectsTo: ['dewatering'] }),
    makeObject('dewatering', 'dewatering', { lengthM: 5, widthM: 3 }),
    makeObject('aerobic-blower', 'blower', { lengthM: 2.4, widthM: 1.6 }),
  ];
}
