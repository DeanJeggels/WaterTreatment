/**
 * instantiateMleMbr — turn an MleMbrDesign (from @repo/sim-engine) into placed-
 * able EngineeringObjects. Pure, deterministic, NO re-derivation: every sized
 * magnitude is copied verbatim from the design. The MBR is modelled as a cassette
 * object NESTED INSIDE the aeration tank (ext.parentId), so the CAD/3D shows the
 * membranes in the tank; the biological-aeration and MBR-scour blowers are
 * distinct objects.
 */
import type { MleMbrDesign } from '@repo/sim-engine';
import { SCHEMA_VERSION } from './types';
import type { EngineeringObject, Dimension } from './types';
import { allocateTag } from './tags';
import { materialFor } from './materials';

export interface MleMbrInstantiateOptions {
  flowsheetId: string;
}

const dim = (value: number, unit: string): Dimension => ({ value, unit });
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Square footprint from a volume + depth (+0.5 m freeboard on height). */
function tankGeometry(volM3: number, depthM = 4.5) {
  const side = round2(Math.sqrt(volM3 / depthM));
  return {
    shape: 'rectangle' as const,
    footprint: { lengthM: side, widthM: side },
    heightM: dim(round2(depthM + 0.5), 'm'),
    freeboardM: dim(0.5, 'm'),
    capacity: dim(round2(volM3), 'm3'),
  };
}

export function instantiateMleMbr(design: MleMbrDesign, opts: MleMbrInstantiateOptions): EngineeringObject[] {
  const objects: EngineeringObject[] = [];
  const fid = opts.flowsheetId;
  const areaSeq = new Map<number, number>();
  const nextSeq = (area: number): number => {
    const s = (areaSeq.get(area) ?? 0) + 1;
    areaSeq.set(area, s);
    return s;
  };
  const allRecords = design.calculationRecords;

  const eqTank = design.tanks.find((t) => t.name.toLowerCase().includes('buffer'));
  const anoxicTank = design.tanks.find((t) => t.name.toLowerCase().includes('anoxic'));
  const aerTank = design.tanks.find((t) => t.name.toLowerCase().includes('aeration'));

  const id = (s: string) => `obj-${s}`;
  const BUFFER = id('buffer');
  const ANOXIC = id('anoxic');
  const AERATION = id('aeration');
  const CASSETTE = id('mbr-cassette');
  const PROC_BLOWER = id('process-blower');
  const SCOUR_BLOWER = id('scour-blower');
  const PERMEATE = id('permeate-pump');
  const UV = id('uv');
  const DOSING = id('naocl-dosing');

  // ---- Buffer / EQ tank (area 1) ----
  if (eqTank) {
    objects.push({
      schemaVersion: SCHEMA_VERSION,
      id: BUFFER,
      tag: allocateTag(1, 'equalisation_tank', nextSeq(1)),
      class: 'tank',
      discipline: 'process',
      label: 'Buffer / equalisation tank',
      geometry: tankGeometry(eqTank.volumeM3),
      placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'headworks' },
      material: materialFor('equalisation_tank'),
      capacity: { volume: dim(eqTank.volumeM3, 'm3') },
      params: { kind: 'tank', function: 'equalisation', volumeM3: dim(eqTank.volumeM3, 'm3'), sideWaterDepthM: dim(4.5, 'm'), hydraulicRetentionTimeH: dim(12, 'h'), bunded: false },
      ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'out', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }],
      connections: [{ toObjectId: ANOXIC, toPort: 'in', medium: 'water' }],
      designNotes: ['Buffer volume = 0.5 × ADWF (12 h holding).'],
      sourceCalc: { flowsheetId: fid, nodeId: 'buffer', unitType: 'equalisation_tank', sizingKeys: ['volume'], records: [] },
    });
  }

  // ---- Anoxic tank (area 2) ----
  if (anoxicTank) {
    objects.push({
      schemaVersion: SCHEMA_VERSION,
      id: ANOXIC,
      tag: allocateTag(2, 'bioreactor_anoxic', nextSeq(2)),
      class: 'reactor',
      discipline: 'process',
      label: 'Anoxic reactor',
      geometry: tankGeometry(anoxicTank.volumeM3),
      placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'process' },
      material: materialFor('bioreactor_anoxic'),
      capacity: { volume: dim(design.reactor.anoxicVolumeM3, 'm3'), depth: dim(4.5, 'm') },
      params: { kind: 'tank', function: 'anoxic', volumeM3: dim(design.reactor.anoxicVolumeM3, 'm3'), sideWaterDepthM: dim(4.5, 'm'), hydraulicRetentionTimeH: dim(design.reactor.anoxicHrtH, 'h'), bunded: false },
      ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'out', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'recycle', role: 'recycle', localOffset: { x: 0, y: 0, z: 0 } }],
      connections: [{ toObjectId: AERATION, toPort: 'in', medium: 'water' }],
      designNotes: [`Anoxic mass fraction ${design.constants.anoxicMassFraction}; a-recycle ${design.process.recycle.a}×Q.`],
      sourceCalc: { flowsheetId: fid, nodeId: 'anoxic', unitType: 'bioreactor_anoxic', sizingKeys: ['volume'], records: [] },
    });
  }

  // ---- Aeration tank WITH MBR (area 2) ----
  const aerVol = design.reactor.aerobicVolumeM3;
  const aerGeom = tankGeometry(aerTank?.volumeM3 ?? aerVol);
  objects.push({
    schemaVersion: SCHEMA_VERSION,
    id: AERATION,
    tag: allocateTag(2, 'bioreactor_aerobic', nextSeq(2)),
    class: 'reactor',
    discipline: 'process',
    label: 'Aeration tank with MBR',
    geometry: aerGeom,
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'process' },
    material: materialFor('bioreactor_aerobic'),
    capacity: { volume: dim(aerVol, 'm3'), MLSS: dim(design.process.mlssMgL, 'mg/L'), depth: dim(4.5, 'm') },
    params: {
      kind: 'tank', function: 'mbr', volumeM3: dim(aerVol, 'm3'), sideWaterDepthM: dim(4.5, 'm'),
      hydraulicRetentionTimeH: dim(design.reactor.aerobicHrtH, 'h'), mlssMgL: dim(design.process.mlssMgL, 'mg/L'),
      diffuserCount: design.aeration.diffuserCount, bunded: false,
    },
    ports: [
      { id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } },
      { id: 'permeate', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } },
      { id: 'air', role: 'air', localOffset: { x: 0, y: 0, z: 0 } },
      { id: 'recycle', role: 'recycle', localOffset: { x: 0, y: 0, z: 0 } },
    ],
    connections: [{ toObjectId: ANOXIC, toPort: 'recycle', medium: 'water' }],
    designNotes: [`MBR membranes located inside the aeration tank. ${design.aeration.diffuserCount} fine-bubble diffusers; MLSS ${design.process.mlssMgL} mg/L.`],
    sourceCalc: { flowsheetId: fid, nodeId: 'aeration', unitType: 'bioreactor_aerobic', sizingKeys: ['volume', 'MLSS'], records: [...allRecords] },
  });

  // ---- MBR cassette NESTED inside the aeration tank ----
  if (design.mbr.included) {
    const cassetteLen = round2(Math.min(aerGeom.footprint.lengthM * 0.5, 1.5 * design.mbr.moduleCount));
    const cassetteWid = round2(Math.min(aerGeom.footprint.widthM * 0.5, 1.2));
    objects.push({
      schemaVersion: SCHEMA_VERSION,
      id: CASSETTE,
      tag: allocateTag(2, 'mbr', nextSeq(2)),
      class: 'membrane',
      discipline: 'mechanical',
      label: `MBR cassette (${design.mbr.moduleCount} × SMU)`,
      geometry: { shape: 'rectangle', footprint: { lengthM: cassetteLen, widthM: cassetteWid }, heightM: dim(2.5, 'm'), capacity: dim(design.mbr.membraneAreaM2, 'm2') },
      placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'process' },
      material: materialFor('mbr'),
      capacity: { membraneArea: dim(design.mbr.membraneAreaM2, 'm2'), moduleCount: dim(design.mbr.moduleCount, 'ea'), flux: dim(design.mbr.fluxLmh, 'L/m2/h') },
      params: { kind: 'tank', function: 'mbr', volumeM3: dim(0, 'm3'), sideWaterDepthM: dim(2.5, 'm'), bunded: false },
      ports: [{ id: 'permeate', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'air', role: 'air', localOffset: { x: 0, y: 0, z: 0 } }],
      connections: [],
      designNotes: [`${design.mbr.moduleCount} × ${design.mbr.model} SMU modules, ${design.mbr.membraneAreaM2} m² @ ${design.mbr.fluxLmh} LMH. Located inside the aeration tank.`],
      sourceCalc: { flowsheetId: fid, nodeId: 'mbr', unitType: 'mbr', sizingKeys: ['membraneArea', 'moduleCount'], records: [] },
      ext: { parentId: AERATION, insideParent: true },
    });
  }

  // ---- Blowers (distinct: process air + MBR scour) (area 2) ----
  const blower = (oid: string, label: string, airAm3h: number, kw: number, scour: boolean, seq: number): EngineeringObject => ({
    schemaVersion: SCHEMA_VERSION,
    id: oid,
    tag: allocateTag(2, 'aeration_blower', seq),
    class: 'blower',
    discipline: 'mechanical',
    label,
    geometry: { shape: 'rectangle', footprint: { lengthM: 2.4, widthM: 1.6 }, heightM: dim(1.8, 'm') },
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'blower' },
    material: materialFor('aeration_blower'),
    capacity: { airFlow: dim(airAm3h, 'Am3/hr'), blowerKW: dim(kw, 'kW') },
    params: { kind: 'blower', blowerType: kw > 50 ? 'hst-turbo' : 'positive-displacement', airFlowAm3H: dim(airAm3h, 'Am3/hr'), dischargePressureKpa: dim(round2(4.5 * 9.81 + 15), 'kPa'), installedKW: dim(kw, 'kW'), configuration: '2 duty + 1 standby', vfd: true },
    ports: [{ id: 'air', role: 'air', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'power', role: 'power', localOffset: { x: 0, y: 0, z: 0 } }],
    connections: [{ toObjectId: scour ? CASSETTE : AERATION, toPort: 'air', medium: 'air' }],
    designNotes: [scour ? 'MBR membrane air scour blower.' : 'Biological process-air blower (fine-bubble diffusers).'],
    sourceCalc: { flowsheetId: fid, nodeId: scour ? 'scour-blower' : 'process-blower', unitType: 'aeration_blower', sizingKeys: ['airFlow', 'blowerKW'], records: [] },
  });
  objects.push(blower(PROC_BLOWER, 'Process air blower', design.aeration.processAirAm3h, design.aeration.blowerKW, false, nextSeq(2)));
  objects.push(blower(SCOUR_BLOWER, 'MBR air scour blower', design.mbr.airScourAm3h, design.mbr.scourBlowerKW, true, nextSeq(2)));

  // ---- Permeate pump (area 3) ----
  objects.push({
    schemaVersion: SCHEMA_VERSION,
    id: PERMEATE,
    tag: allocateTag(3, 'inlet_pumping', nextSeq(3)),
    class: 'pump',
    discipline: 'mechanical',
    label: 'MBR permeate pump',
    geometry: { shape: 'rectangle', footprint: { lengthM: 2.0, widthM: 1.2 }, heightM: dim(1.5, 'm') },
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'process' },
    material: materialFor('inlet_pumping'),
    capacity: { dutyFlow: dim(design.mbr.permeateDutyM3h, 'm3/hr') },
    params: { kind: 'pump', service: 'permeate', pumpType: 'centrifugal', dutyFlowM3H: dim(design.mbr.permeateDutyM3h, 'm3/hr'), headM: dim(8, 'm'), installedKW: dim(round2(Math.max(1.1, design.mbr.permeateDutyM3h * 0.05)), 'kW'), configuration: '1 duty + 1 standby', vfd: true },
    ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'out', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }],
    connections: [{ toObjectId: UV, toPort: 'in', medium: 'water' }],
    designNotes: ['Draws permeate from the MBR cassette under suction.'],
    sourceCalc: { flowsheetId: fid, nodeId: 'permeate-pump', unitType: 'inlet_pumping', sizingKeys: ['dutyFlow'], records: [] },
  });

  // ---- UV disinfection (area 3) ----
  objects.push({
    schemaVersion: SCHEMA_VERSION,
    id: UV,
    tag: allocateTag(3, 'uv_disinfection', nextSeq(3)),
    class: 'disinfection',
    discipline: 'process',
    label: 'UV disinfection channel',
    geometry: { shape: 'rectangle', footprint: { lengthM: 6.0, widthM: 1.2 }, heightM: dim(1.5, 'm') },
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'process' },
    material: materialFor('uv_disinfection'),
    capacity: {},
    params: { kind: 'equipment', equipmentType: 'uv-channel', installedKW: dim(round2(Math.max(1, Math.ceil(design.flows.awwf / 200)) * 0.25), 'kW') },
    ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'out', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }],
    connections: [{ toObjectId: DOSING, toPort: 'in', medium: 'water' }],
    designNotes: [`UV sized on flow: ${Math.max(1, Math.ceil(design.flows.awwf / 200))} lamp bank(s).`],
    sourceCalc: { flowsheetId: fid, nodeId: 'uv', unitType: 'uv_disinfection', sizingKeys: [], records: [] },
  });

  // ---- NaOCl dosing skid (area 3) ----
  objects.push({
    schemaVersion: SCHEMA_VERSION,
    id: DOSING,
    tag: allocateTag(3, 'chemical_dosing', nextSeq(3)),
    class: 'dosing_skid',
    discipline: 'mechanical',
    label: 'Sodium hypochlorite dosing skid',
    geometry: { shape: 'rectangle', footprint: { lengthM: 3.0, widthM: 2.0 }, heightM: dim(2.2, 'm'), capacity: dim(round2(design.utilities.naoclLPerDay * 7 / 1000), 'm3') },
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'chemical' },
    material: materialFor('chemical_dosing'),
    capacity: { dailyConsumption: dim(design.utilities.naoclLPerDay, 'L/d') },
    params: {
      kind: 'dosing_skid', chemical: 'sodium-hypochlorite', doseMgL: dim(2, 'mg/L'),
      dailyConsumptionKg: dim(round2(design.utilities.naoclLPerDay * 0.15), 'kg/d'),
      storageDays: dim(7, 'd'), storageTankVolumeM3: dim(round2(Math.max(0.5, design.utilities.naoclLPerDay * 7 / 1000)), 'm3'),
      meteringPumps: { duty: 1, standby: 1, pumpType: 'diaphragm' }, bunded: true,
    },
    ports: [{ id: 'in', role: 'inlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'out', role: 'outlet', localOffset: { x: 0, y: 0, z: 0 } }, { id: 'dose', role: 'chemical', localOffset: { x: 0, y: 0, z: 0 } }],
    connections: [],
    designNotes: [`NaOCl ${design.utilities.naoclLPerDay} L/day at 2 mg/L Cl (150 g/L product). Final disinfection before treated-water discharge.`],
    sourceCalc: { flowsheetId: fid, nodeId: 'naocl-dosing', unitType: 'chemical_dosing', sizingKeys: ['dailyConsumption'], records: [] },
  });

  return objects;
}
