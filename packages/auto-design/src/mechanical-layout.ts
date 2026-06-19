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

function makeSkid(c: ContainerSpec, sx: number, sy: number): EngineeringObject {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'obj-skid',
    tag: 'SKD-9001-BL',
    class: 'building',
    discipline: 'mechanical',
    label: `Process ${c.label}`,
    geometry: { shape: 'rectangle', footprint: { lengthM: c.L, widthM: c.W }, heightM: { value: c.H, unit: 'm' } },
    placement: { location: { x: sx, y: sy, z: 0.15 }, rotationDeg: 0, zone: 'process' },
    material: { primary: 'Steel', grade: 'galvanised open frame' },
    capacity: {},
    params: { kind: 'equipment', equipmentType: 'other', configuration: c.label },
    ports: [],
    connections: [],
    designNotes: [`Equipment on an open-frame skid (${c.L}×${c.W}×${c.H} m): two rows, 800 mm service aisle, forklift pockets, lifting lugs, pre-fabricated pipework.`],
  };
}

export function arrangeMechanicalLayout(objects: EngineeringObject[], input: MleMbrInputs, design: MleMbrDesign): MechLayoutResult {
  const rules: string[] = [];
  const buffer = objects.find((o) => tankFn(o, 'equalisation'));
  const anoxic = objects.find((o) => tankFn(o, 'anoxic'));
  const aeration = objects.find((o) => tankFn(o, 'mbr') && (o.class === 'reactor' || o.class === 'tank'));
  const tanks = [buffer, anoxic, aeration].filter(Boolean) as EngineeringObject[];
  const blowers = objects.filter((o) => o.class === 'blower');
  const pumps = objects.filter((o) => o.class === 'pump');
  const pumpBy = (svc: string): EngineeringObject | undefined => pumps.find((p) => p.params.kind === 'pump' && p.params.service === svc);
  const permeatePump = pumpBy('permeate');
  const feedPump = pumpBy('transfer');
  const recircPump = pumpBy('RAS');
  const wasPump = pumpBy('WAS');
  const uv = objects.find((o) => o.class === 'disinfection');
  const dosing = objects.find((o) => o.class === 'dosing_skid');
  const cip = objects.find((o) => o.class === 'tank' && o.params.kind === 'tank' && o.params.function === 'contact');
  const silo = objects.find((o) => o.class === 'thickener');
  void design;

  const L = input.footprintLengthM;
  const inGround = input.installationType === 'underground_civil' || input.tankPlacement === 'in_ground';
  const tankZ = (t: EngineeringObject): number => (inGround ? -(heightOf(t)) + 0.15 : 0.15);
  // Submersibles sit at the lowest point of their parent tank when in-ground.
  const floorZ = (t?: EngineeringObject): number => (inGround && t ? -(heightOf(t)) + 0.3 : 0.1);
  const place = (o: EngineeringObject | undefined, x: number, y: number, z: number, rot: number, zone: EngineeringObject['placement']['zone'], facing: string): void => {
    if (!o) return;
    o.placement = { location: { x, y, z }, rotationDeg: rot, zone };
    setFacing(o, facing);
  };
  // Submersible recycle/WAS/feed pumps + sludge silo at their parent tanks (shared by all branches).
  const placeSubmersibles = (rowY: number, aerX: number): void => {
    place(feedPump, buffer?.placement.location.x ?? 5, rowY, floorZ(buffer), 0, 'headworks', 'submersible in the buffer tank, at the lowest point; discharge to the anoxic reactor');
    place(recircPump, aerX - 1.5, rowY, floorZ(aeration), 0, 'process', 'submersible mixed-liquor recycle to the anoxic reactor');
    place(wasPump, aerX + 1.5, rowY, floorZ(aeration), 0, 'sludge', 'submersible WAS draw to the thickening silo, at the lowest point');
    place(silo, aerX + 5, rowY + (aeration?.geometry.footprint.widthM ?? 4) / 2 + 3 + (silo?.geometry.footprint.widthM ?? 3) / 2, tankZ(silo ?? aeration!), 0, 'sludge', 'gravity thickening silo in the sludge area');
  };
  const faceTanks = (): void => {
    for (const t of tanks) setFacing(t, 'inlet upstream (−X), outlet downstream (+X), drain at base sump');
    if (aeration) setFacing(aeration, 'inlet upstream; permeate draw-off faces the permeate pump; air diffusers at base; drain at sump');
  };

  const spec = CONTAINER[input.installationType];
  const isSkid = input.installationType === 'open_frame_skid';

  if (spec && !isSkid) {
    // ---------- containerised (20 ft / 40 ft / twin) ----------
    const cx = Math.max(4 + spec.L / 2, L * 0.4);
    const cy = 4 + spec.W / 2;
    const container = makeContainer(spec, cx, cy);
    const x0 = cx - spec.L / 2;
    const zoneX = (frac: number): number => x0 + spec.L * frac;
    const inside = (o: EngineeringObject | undefined, frac: number, rot: number, zone: string, facing: string): void => {
      if (!o) return;
      o.placement = { location: { x: zoneX(frac), y: cy, z: 0.2 }, rotationDeg: rot, zone: o.placement.zone };
      o.ext = { ...(o.ext ?? {}), parentContainer: container.id, containerZone: zone, penetrationZone: 'A', orientation: facing };
    };
    if (input.installationType !== 'container_20ft') {
      // 40 ft / twin: A wet/permeate, B blowers, C CIP+dosing+UV, D control
      inside(permeatePump, 0.10, 90, 'A', 'permeate suction manifold; floor penetrations at Zone A');
      blowers.forEach((b, i) => inside(b, 0.34 + i * 0.07, i === 0 ? 90 : 270, 'B', 'duty/standby mirror pair, inlets outward, outlets to common air header'));
      inside(cip, 0.60, 0, 'C', 'CIP tank adjacent to the membrane connection');
      inside(dosing, 0.72, 0, 'C', 'day-tank gravity feed; injection quill to permeate line; chemical access from outside');
      inside(uv, 0.86, 0, 'C', 'UV in-line after permeate');
      rules.push('40 ft container zones: A wet end/permeate pumps, B aeration + scour blowers, C CIP + dosing + UV, D control/instrumentation; 700 mm central aisle, anti-vibration mounts, floor penetrations at Zone A only.');
    } else {
      // 20 ft: A pumps/manifolds, B blowers+CIP+dosing, C UV/control
      inside(permeatePump, 0.14, 90, 'A', 'permeate suction manifold; floor penetrations at Zone A');
      blowers.forEach((b, i) => inside(b, 0.40 + i * 0.08, i === 0 ? 90 : 270, 'B', 'duty/standby mirror pair, inlets outward, outlets to common air header'));
      inside(cip, 0.52, 0, 'B', 'CIP tank adjacent to the membrane connection');
      inside(dosing, 0.64, 0, 'B', 'day-tank gravity feed; chemical access from outside');
      inside(uv, 0.86, 0, 'C', 'UV + control at the back wall');
      rules.push('20 ft container zones: A pumps/manifolds, B blowers + CIP + dosing, C UV/control; 700 mm central aisle, anti-vibration mounts, floor penetrations at Zone A only.');
    }

    const maxHalfW = Math.max(...tanks.map((t) => t.geometry.footprint.widthM / 2), 2);
    const extY = cy + spec.W / 2 + 3 + maxHalfW;
    layoutTankRow(tanks, { startX: 4, y: extY, gap: 0.5, z: tankZ, rotation: 0 });
    faceTanks();
    placeSubmersibles(extY, aeration?.placement.location.x ?? 9);
    rules.push(`Biological tanks external to the container in process-flow order, ≥500 mm between walls, ${inGround ? 'set in-ground (top at FFL); submersibles at the lowest point' : 'on plinths +150 mm above FFL'}; Zone A faces the array.`);
    return { container, appliedRules: rules };
  }

  if (isSkid && spec) {
    // ---------- open-frame skid (no envelope, no floor penetrations) ----------
    const sx = Math.max(4 + spec.L / 2, L * 0.4);
    const sy = 4 + spec.W / 2;
    const frame = makeSkid(spec, sx, sy);
    const rowY = [sy - spec.W * 0.25, sy + spec.W * 0.25];
    const items = [permeatePump, blowers[0], blowers[1], cip, dosing, uv].filter(Boolean) as EngineeringObject[];
    const x0 = sx - spec.L / 2 + 0.6;
    items.forEach((o, i) => {
      o.placement = { location: { x: x0 + (i % 3) * (spec.L / 3), y: rowY[i < 3 ? 0 : 1]!, z: 0.3 }, rotationDeg: 0, zone: o.placement.zone };
      o.ext = { ...(o.ext ?? {}), parentSkid: frame.id, orientation: 'open-frame skid: two rows with 800 mm service aisle, pre-fabricated pipework' };
    });
    rules.push('Open-frame skid: equipment in two rows with an 800 mm service aisle, forklift pockets both short ends, lifting lugs at the four corners, pre-fabricated pipework (no envelope, no floor penetrations).');

    const maxHalfW = Math.max(...tanks.map((t) => t.geometry.footprint.widthM / 2), 2);
    const extY = sy + spec.W / 2 + 3 + maxHalfW;
    layoutTankRow(tanks, { startX: 4, y: extY, gap: 0.5, z: tankZ, rotation: 0 });
    faceTanks();
    placeSubmersibles(extY, aeration?.placement.location.x ?? 9);
    return { container: frame, appliedRules: rules };
  }

  // ---------- civil (above-ground / underground) ----------
  const tankRowY = Math.max(8, input.footprintWidthM * 0.6);
  const rightCursor = layoutTankRow(tanks, { startX: 3, y: tankRowY, gap: 0.5, z: tankZ, rotation: 0 });
  faceTanks();
  rules.push(`Installation ${input.installationType}: tanks in process-flow order along the longest site axis, ≥500 mm between walls, ${inGround ? 'set in-ground (top at FFL ±150 mm); submersibles at the lowest point' : 'on plinths +150 mm above FFL'}.`);

  // UV + dosing continue downstream of the tank array, on the process line
  let cursor = rightCursor;
  for (const d of [uv, dosing].filter(Boolean) as EngineeringObject[]) {
    d.placement = { location: { x: cursor + halfLen(d), y: tankRowY, z: 0.15 }, rotationDeg: 0, zone: d.placement.zone };
    cursor += d.geometry.footprint.lengthM + 0.5;
    setFacing(d, d.class === 'disinfection' ? 'in-line after permeate; isolation penstocks up/downstream' : 'day tank gravity-feeds the metering pumps; injection quill to the treated-water line; chemical access from the site road');
  }

  // CIP tank adjacent to the MBR/aeration tank (pump outlet faces the membrane connection)
  const aerX = aeration?.placement.location.x ?? tanks[0]?.placement.location.x ?? 6;
  place(cip, aerX, tankRowY + (aeration?.geometry.footprint.widthM ?? 4) / 2 + 2 + (cip?.geometry.footprint.widthM ?? 2) / 2, 0.15, 0, 'chemical', 'CIP tank adjacent to the membrane tank; pump outlet faces the MBR connection');

  // plant room: blowers + permeate pump in a band IN FRONT of the tanks (−Y), at the aeration tank for the shortest air run
  const eqRowY = tankRowY - (aeration?.geometry.footprint.widthM ?? 4) / 2 - 3;
  blowers.forEach((b, i) => {
    b.placement = { location: { x: aerX - 2 + i * 3, y: eqRowY, z: 0.1 }, rotationDeg: i === 0 ? 90 : 270, zone: 'blower' };
    setFacing(b, 'duty/standby mirror pair, inlets facing outward, outlets to the common air header');
  });
  place(permeatePump, aerX + 2.5, eqRowY - 2.5, 0.1, 0, 'process', 'suction to the MBR permeate manifold, discharge to UV');
  placeSubmersibles(tankRowY, aerX);
  rules.push('Mechanical plant grouped in a plant-room band in front of the tank array; blowers mirrored adjacent to the aeration tank (shortest air run); CIP tank adjacent to the membrane tank; dosing at the downstream end (day-tank gravity feed); submersible feed/recycle/WAS pumps at their tanks.');

  return { appliedRules: rules };
}
