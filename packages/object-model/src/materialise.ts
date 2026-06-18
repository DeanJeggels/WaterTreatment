/**
 * instantiateObjects — THE materialiser (T3.3). Turns each sized sim-engine node
 * into a spatial, tagged EngineeringObject WITHOUT re-deriving any engineering
 * number: `capacity` is a verbatim copy of the node's sizing, and
 * `sourceCalc.records` is a by-value copy of its CalculationRecords. Geometry is
 * a pure layout transform (dimension-deriver); tags/materials come from the
 * deterministic tables. Rule-based, deterministic, NO AI.
 *
 * Stream boundaries (influent/effluent) are not physical equipment and are
 * skipped. The aerobic reactor additionally spawns a blower object from its
 * folded-in air sizing (the energy trail rides on the blower).
 */
import { unitDefinitions } from '@repo/sim-engine';
import type { SimulationResults, CalculationRecord, UnitType, HandleDef } from '@repo/sim-engine';
import { SCHEMA_VERSION } from './types';
import type {
  EngineeringObject,
  ObjectClass,
  Discipline,
  Port,
  ObjectParams,
  ConnectionMedium,
  Dimension,
  GenericEquipmentParams,
  TankParams,
} from './types';
import { deriveGeometry } from './dimension-deriver';
import { allocateTag, processAreaFor } from './tags';
import { materialFor } from './materials';

export interface MaterialiserNode {
  id: string;
  unitType: UnitType;
  parameters?: Record<string, number>;
}

export interface MaterialiserEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface MaterialiseOptions {
  flowsheetId: string;
}

/** Stream boundaries — flow markers, not physical structures. */
const SKIP_UNITS = new Set<UnitType>(['influent', 'effluent', 'splitter', 'mixer']);

const CLASS_BY_UNIT: Partial<Record<UnitType, ObjectClass>> = {
  inlet_pumping: 'pump',
  screen: 'screen',
  grit_removal: 'equipment',
  equalisation_tank: 'tank',
  bioreactor_anoxic: 'reactor',
  bioreactor_aerobic: 'reactor',
  bioreactor_anaerobic: 'reactor',
  primary_clarifier: 'clarifier',
  secondary_clarifier: 'clarifier',
  mbr: 'membrane',
  uv_disinfection: 'disinfection',
  thickener: 'thickener',
  dewatering: 'dewatering',
  chemical_dosing: 'dosing_skid',
};

const PROCESS_CLASSES = new Set<ObjectClass>([
  'tank', 'reactor', 'clarifier', 'membrane', 'disinfection', 'thickener',
]);
const TANK_LIKE = new Set<ObjectClass>(['tank', 'reactor', 'clarifier', 'membrane']);

function disciplineFor(objectClass: ObjectClass): Discipline {
  return PROCESS_CLASSES.has(objectClass) ? 'process' : 'mechanical';
}

function tankFunction(unitType: UnitType): TankParams['function'] {
  switch (unitType) {
    case 'equalisation_tank': return 'equalisation';
    case 'bioreactor_anoxic': return 'anoxic';
    case 'bioreactor_aerobic': return 'aeration';
    case 'bioreactor_anaerobic': return 'anaerobic';
    case 'primary_clarifier':
    case 'secondary_clarifier': return 'clarifier';
    case 'mbr': return 'mbr';
    default: return 'buffer';
  }
}

const EQUIPMENT_TYPE: Partial<Record<UnitType, GenericEquipmentParams['equipmentType']>> = {
  screen: 'fine-screen',
  grit_removal: 'grit-classifier',
  uv_disinfection: 'uv-channel',
  thickener: 'belt-thickener',
  dewatering: 'centrifuge',
};

function portRole(handle: HandleDef): Port['role'] {
  if (handle.id === 'air') return 'air';
  if (['underflow', 'reject', 'cake', 'filtrate'].includes(handle.id)) return 'waste';
  return handle.type === 'input' ? 'inlet' : 'outlet';
}

function mediumForHandle(handleId: string | undefined): ConnectionMedium {
  if (!handleId) return 'water';
  if (['underflow', 'reject', 'thickened', 'cake'].includes(handleId)) return 'sludge';
  if (handleId === 'air') return 'air';
  if (handleId === 'chemical' || handleId === 'dose_out') return 'chemical';
  return 'water';
}

function portsFor(unitType: UnitType): Port[] {
  const handles = unitDefinitions[unitType]?.handles ?? [];
  return handles.map((h) => ({ id: h.id, role: portRole(h), localOffset: { x: 0, y: 0, z: 0 } }));
}

function buildParams(
  unitType: UnitType,
  objectClass: ObjectClass,
  sizing: Record<string, Dimension>,
  geometryCapacity: Dimension | undefined,
  installedKW: number | undefined,
): ObjectParams {
  if (TANK_LIKE.has(objectClass)) {
    const params: TankParams = {
      kind: 'tank',
      function: tankFunction(unitType),
      volumeM3: sizing.volume ?? geometryCapacity ?? { value: 0, unit: 'm3' },
      sideWaterDepthM: sizing.depth ?? { value: 4, unit: 'm' },
      bunded: false,
    };
    if (sizing.HRT) params.hydraulicRetentionTimeH = sizing.HRT;
    if (sizing.MLSS) params.mlssMgL = sizing.MLSS;
    if (sizing.SOR) params.surfaceLoadingRateM3M2H = sizing.SOR;
    return params;
  }
  const params: GenericEquipmentParams = {
    kind: 'equipment',
    equipmentType: EQUIPMENT_TYPE[unitType] ?? 'other',
  };
  const cap = sizing.volume ?? sizing.surfaceArea ?? sizing.tankVolume;
  if (cap) params.capacity = cap;
  if (installedKW !== undefined) params.installedKW = { value: installedKW, unit: 'kW' };
  return params;
}

export function instantiateObjects(
  nodes: MaterialiserNode[],
  edges: MaterialiserEdge[],
  results: SimulationResults,
  opts: MaterialiseOptions,
): EngineeringObject[] {
  const physical = nodes.filter((n) => !SKIP_UNITS.has(n.unitType) && CLASS_BY_UNIT[n.unitType]);

  // Map every node id to its primary object id (skipped nodes resolve to undefined).
  const objectIdByNode = new Map<string, string>();
  for (const n of physical) objectIdByNode.set(n.id, `obj-${n.id}`);

  const areaSeq = new Map<number, number>();
  const nextSeq = (area: number): number => {
    const s = (areaSeq.get(area) ?? 0) + 1;
    areaSeq.set(area, s);
    return s;
  };

  const objects: EngineeringObject[] = [];

  for (const node of physical) {
    const objectClass = CLASS_BY_UNIT[node.unitType]!;
    const result = results.nodeResults[node.id];
    const sizing = result?.sizing ?? {};
    const calcRecords = result?.calculationRecords ?? [];
    const energyRecords = result?.energy?.records ?? [];
    const installedKW = result?.energy?.installedKW;
    const warnings = result?.warnings ?? [];

    const { geometry, notes } = deriveGeometry(objectClass, sizing);
    const area = processAreaFor(node.unitType);
    const tag = allocateTag(area, node.unitType, nextSeq(area));

    // Connections out of this node, resolved to target OBJECT ids (drop boundaries).
    const connections = edges
      .filter((e) => e.source === node.id)
      .map((e) => {
        const toObjectId = objectIdByNode.get(e.target);
        return toObjectId
          ? { toObjectId, toPort: e.targetHandle ?? 'in', medium: mediumForHandle(e.sourceHandle) }
          : undefined;
      })
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const isAerobic = node.unitType === 'bioreactor_aerobic';

    objects.push({
      schemaVersion: SCHEMA_VERSION,
      id: `obj-${node.id}`,
      tag,
      class: objectClass,
      discipline: disciplineFor(objectClass),
      label: unitDefinitions[node.unitType]?.label ?? node.unitType,
      geometry,
      placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0 },
      material: materialFor(node.unitType),
      capacity: { ...sizing }, // VERBATIM copy — no loss, never re-derived
      params: buildParams(node.unitType, objectClass, sizing, geometry.capacity, installedKW),
      ports: portsFor(node.unitType),
      connections,
      designNotes: [...notes, ...warnings],
      sourceCalc: {
        flowsheetId: opts.flowsheetId,
        nodeId: node.id,
        unitType: node.unitType,
        sizingKeys: Object.keys(sizing),
        // Aerobic keeps its sizing trail; the blower below carries the energy trail.
        // Everything else carries both on its single object.
        records: isAerobic ? [...calcRecords] : [...calcRecords, ...energyRecords],
      },
    });

    // The aerobic reactor spawns a blower from its folded-in air sizing.
    if (isAerobic && sizing.airFlow) {
      objects.push(buildBlower(node.id, sizing, energyRecords, installedKW, nextSeq(2), opts.flowsheetId));
    }
  }

  return objects;
}

/** Derive the process-air blower object from the aerobic reactor's air sizing. */
function buildBlower(
  aerobicNodeId: string,
  sizing: Record<string, Dimension>,
  energyRecords: CalculationRecord[],
  installedKW: number | undefined,
  seq: number,
  flowsheetId: string,
): EngineeringObject {
  const { geometry, notes } = deriveGeometry('blower', {});
  const blowerKW = sizing.blowerKW?.value ?? installedKW ?? 0;
  // ΔP is computed by sim-engine and lives verbatim in a record input — copy it.
  const dP = findRecordInput(energyRecords, 'dP') ?? findRecordInput(energyRecords, 'deltaP');

  return {
    schemaVersion: SCHEMA_VERSION,
    id: `obj-${aerobicNodeId}-blower`,
    tag: allocateTag(2, 'aeration_blower', seq),
    class: 'blower',
    discipline: 'mechanical',
    label: 'Process Air Blower',
    geometry,
    placement: { location: { x: 0, y: 0, z: 0 }, rotationDeg: 0, zone: 'blower' },
    material: materialFor('aeration_blower'),
    capacity: {
      ...(sizing.airFlow ? { airFlow: sizing.airFlow } : {}),
      ...(sizing.blowerKW ? { blowerKW: sizing.blowerKW } : {}),
    },
    params: {
      kind: 'blower',
      blowerType: blowerKW > 50 ? 'hst-turbo' : 'positive-displacement',
      airFlowAm3H: sizing.airFlow ?? { value: 0, unit: 'Am3/hr' },
      dischargePressureKpa: dP ?? { value: 0, unit: 'kPa' },
      installedKW: sizing.blowerKW ?? { value: blowerKW, unit: 'kW' },
      configuration: '2 duty + 1 standby',
      vfd: true,
    },
    ports: [
      { id: 'air', role: 'air', localOffset: { x: 0, y: 0, z: 0 } },
      { id: 'power', role: 'power', localOffset: { x: 0, y: 0, z: 0 } },
    ],
    connections: [],
    designNotes: [
      ...notes,
      `blower type ${blowerKW > 50 ? 'HST turbo' : 'positive-displacement'} selected: ${blowerKW.toFixed(1)} kW vs 50 kW HST threshold (sim-engine rule)`,
    ],
    sourceCalc: {
      flowsheetId,
      nodeId: aerobicNodeId,
      unitType: 'aeration_blower',
      sizingKeys: ['airFlow', 'blowerKW'],
      records: [...energyRecords],
    },
  };
}

function findRecordInput(records: CalculationRecord[], key: string): Dimension | undefined {
  for (const r of records) {
    const input = r.inputs[key];
    if (input) return { value: input.value, unit: input.unit };
  }
  return undefined;
}
