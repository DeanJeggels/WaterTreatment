/**
 * arrangeMechanicalLayout — Stage 4 of the master spec. Applies the deterministic
 * installation-type placement + orientation rules ON TOP of the instantiated
 * objects (overriding the generic packer's placements). Two strategies:
 *   - civil (underground / above-ground): tanks in process-flow order along the
 *     longest site axis with ≥500 mm between walls; mechanical plant grouped in a
 *     plant-room band in front of the array (shortest air run to the blowers).
 *   - containerised / skid: equipment housed inside a container object in fixed
 *     zones (A pumps, B blowers/dosing, C UV/control); tanks external, Zone A
 *     facing the array.
 * Pure + deterministic. Orientation per item is recorded in ext.orientation.
 */
import type { MleMbrDesign } from '@repo/sim-engine';
import { SCHEMA_VERSION, type EngineeringObject } from '@repo/object-model';
import type { MleMbrInputs, InstallationType } from './inputs';

interface ContainerSpec { L: number; W: number; H: number; label: string }
const CONTAINER: Partial<Record<InstallationType, ContainerSpec>> = {
  container_20ft: { L: 5.898, W: 2.352, H: 2.393, label: '20 ft container' },
  container_40ft: { L: 12.032, W: 2.352, H: 2.393, label: '40 ft container' },
  container_twin_20ft: { L: 5.898, W: 4.9, H: 2.393, label: 'twin 20 ft container' },
  open_frame_skid: { L: 6.0, W: 2.5, H: 2.6, label: 'open-frame skid' },
};

export interface MechLayoutResult {
  /** A container/skid housing object for containerised installs (else undefined). */
  container?: EngineeringObject;
  appliedRules: string[];
}

const setFacing = (o: EngineeringObject, orientation: string): void => {
  o.ext = { ...(o.ext ?? {}), orientation };
};
const tankFn = (o: EngineeringObject, fn: string): boolean => o.params.kind === 'tank' && o.params.function === fn;
const halfLen = (o: EngineeringObject): number => o.geometry.footprint.lengthM / 2;
const heightOf = (o: EngineeringObject): number => o.geometry.heightM?.value ?? 5;

interface RowOpts { startX: number; y: number; gap: number; z: (t: EngineeringObject) => number; rotation: number }
function layoutTankRow(tanks: EngineeringObject[], opts: RowOpts): number {
  let cursor = opts.startX;
  for (const t of tanks) {
    const len = t.geometry.footprint.lengthM;
    t.placement = { location: { x: cursor + len / 2, y: opts.y, z: opts.z(t) }, rotationDeg: opts.rotation, zone: t.placement.zone };
    cursor += len + opts.gap;
  }
  return cursor; // right edge cursor (one gap past the last tank)
}

function makeContainer(c: ContainerSpec, cx: number, cy: number): EngineeringObject {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'obj-container',
    tag: 'CNT-9001-BL',
    class: 'building',
    discipline: 'mechanical',
    label: `Process ${c.label}`,
    geometry: { shape: 'rectangle', footprint: { lengthM: c.L, widthM: c.W }, heightM: { value: c.H, unit: 'm' } },
    placement: { location: { x: cx, y: cy, z: 0.15 }, rotationDeg: 0, zone: 'process' },
    material: { primary: 'Steel', grade: 'ISO shipping container' },
    capacity: {},
    params: { kind: 'equipment', equipmentType: 'other', configuration: c.label },
    ports: [],
    connections: [],
    designNotes: [`Equipment housed in a ${c.label} (internal ${c.L}×${c.W}×${c.H} m). Zone A faces the tank array; 700 mm central aisle; pipe penetrations at the Zone A floor only.`],
  };
}

export function arrangeMechanicalLayout(objects: EngineeringObject[], input: MleMbrInputs, design: MleMbrDesign): MechLayoutResult {
  const rules: string[] = [];
  const buffer = objects.find((o) => tankFn(o, 'equalisation'));
  const anoxic = objects.find((o) => tankFn(o, 'anoxic'));
  const aeration = objects.find((o) => tankFn(o, 'mbr') && (o.class === 'reactor' || o.class === 'tank'));
  const tanks = [buffer, anoxic, aeration].filter(Boolean) as EngineeringObject[];
  const blowers = objects.filter((o) => o.class === 'blower');
  const pump = objects.find((o) => o.class === 'pump');
  const uv = objects.find((o) => o.class === 'disinfection');
  const dosing = objects.find((o) => o.class === 'dosing_skid');

  const L = input.footprintLengthM;
  const inGround = input.installationType === 'underground_civil' || input.tankPlacement === 'in_ground';
  const tankZ = (t: EngineeringObject): number => (inGround ? -(heightOf(t)) + 0.15 : 0.15);
  void design;

  const spec = CONTAINER[input.installationType];
  if (spec) {
    // ---------- containerised / skid ----------
    const cx = Math.max(4 + spec.L / 2, L * 0.4);
    const cy = 4 + spec.W / 2;
    const container = makeContainer(spec, cx, cy);
    rules.push(`Installation ${input.installationType}: equipment housed in a ${spec.label} (internal ${spec.L}×${spec.W} m), Zone A facing the tank array.`);

    const x0 = cx - spec.L / 2;
    const zoneX = (frac: number): number => x0 + spec.L * frac;
    const inside = (o: EngineeringObject | undefined, frac: number, rot: number, zone: string, facing: string): void => {
      if (!o) return;
      o.placement = { location: { x: zoneX(frac), y: cy, z: 0.2 }, rotationDeg: rot, zone: o.placement.zone };
      o.ext = { ...(o.ext ?? {}), parentContainer: container.id, containerZone: zone, orientation: facing };
    };
    const is40 = input.installationType === 'container_40ft';
    if (is40) {
      inside(pump, 0.12, 90, 'A', 'suction to external tanks via Zone A floor penetrations');
      blowers.forEach((b, i) => inside(b, 0.37 + i * 0.07, i === 0 ? 90 : 270, 'B', 'mirror pair, inlets outward, outlets to common air header'));
      inside(dosing, 0.66, 0, 'C', 'injection quill to permeate line; chemical access from outside');
      inside(uv, 0.84, 0, 'C', 'UV in-line after permeate, control at back wall');
    } else {
      inside(pump, 0.16, 90, 'A', 'suction to external tanks via Zone A floor penetrations');
      blowers.forEach((b, i) => inside(b, 0.44 + i * 0.09, i === 0 ? 90 : 270, 'B', 'mirror pair, inlets outward, outlets to common air header'));
      inside(dosing, 0.5, 0, 'B', 'chemical dosing, access from outside');
      inside(uv, 0.84, 0, 'C', 'UV + control at back wall');
    }
    rules.push('Container zone layout: Zone A pumps/manifolds, Zone B blowers/dosing, Zone C UV/control; 700 mm central aisle, anti-vibration mounts, pipe penetrations at the Zone A floor only.');

    const maxHalfW = Math.max(...tanks.map((t) => t.geometry.footprint.widthM / 2), 2);
    layoutTankRow(tanks, { startX: 4, y: cy + spec.W / 2 + 3 + maxHalfW, gap: 0.5, z: tankZ, rotation: 0 });
    for (const t of tanks) setFacing(t, 'inlet upstream (−X), outlet downstream (+X), drain at base sump');
    rules.push(`Biological tanks external to the container in process-flow order, ≥500 mm between walls, ${inGround ? 'set in-ground (top at FFL)' : 'on plinths +150 mm above FFL'}.`);
    return { container, appliedRules: rules };
  }

  // ---------- civil (above-ground / underground) ----------
  const tankRowY = Math.max(8, input.footprintWidthM * 0.6);
  const rightCursor = layoutTankRow(tanks, { startX: 3, y: tankRowY, gap: 0.5, z: tankZ, rotation: 0 });
  for (const t of tanks) setFacing(t, 'inlet upstream (−X), outlet downstream (+X), drain at base sump');
  rules.push(`Installation ${input.installationType}: tanks in process-flow order along the longest site axis, ≥500 mm between walls, ${inGround ? 'set in-ground (top at FFL ±150 mm)' : 'on plinths +150 mm above FFL'}.`);

  // UV + dosing continue downstream of the tank array, on the process line
  let cursor = rightCursor;
  for (const d of [uv, dosing].filter(Boolean) as EngineeringObject[]) {
    d.placement = { location: { x: cursor + halfLen(d), y: tankRowY, z: 0.15 }, rotationDeg: 0, zone: d.placement.zone };
    cursor += d.geometry.footprint.lengthM + 0.5;
    setFacing(d, d.class === 'disinfection' ? 'in-line after permeate; isolation penstocks up/downstream' : 'injection quill to treated-water line; chemical access from the site road');
  }

  // plant room: blowers + permeate pump in a band IN FRONT of the tanks (−Y), grouped at the aeration tank for the shortest air run
  const aerX = aeration?.placement.location.x ?? tanks[0]?.placement.location.x ?? 6;
  const eqRowY = tankRowY - (aeration?.geometry.footprint.widthM ?? 4) / 2 - 3;
  blowers.forEach((b, i) => {
    b.placement = { location: { x: aerX - 2 + i * 3, y: eqRowY, z: 0.1 }, rotationDeg: i === 0 ? 90 : 270, zone: 'blower' };
    setFacing(b, 'duty/standby mirror pair, inlets facing outward, outlets to the common air header');
  });
  if (pump) {
    pump.placement = { location: { x: aerX + 2.5, y: eqRowY - 2.5, z: 0.1 }, rotationDeg: 0, zone: 'process' };
    setFacing(pump, 'suction to the MBR permeate manifold, discharge to UV');
  }
  rules.push('Mechanical plant grouped in a plant-room band in front of the tank array; blowers mirrored adjacent to the aeration tank (shortest air run); dosing at the downstream end, chemical access from outside the process area.');

  return { appliedRules: rules };
}
