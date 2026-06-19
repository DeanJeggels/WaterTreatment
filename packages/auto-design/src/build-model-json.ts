/**
 * buildModelJson — Stage 6 of the master spec. Serialises the placed, detailed
 * EngineeringObjects + the design into the complete structured "3D model data"
 * the rendering / BIM engine consumes WITHOUT any extra lookup: an equipment
 * array, a pipework array (one sized run per connection — flow, DN, velocity,
 * material, routing waypoints, colour code), and a layout object (site, hardstand,
 * access, drainage, pipe corridors). Pure + deterministic; pipe sizing applies the
 * fixed velocity bands (no engineering is invented).
 */
import type { MleMbrDesign } from '@repo/sim-engine';
import { pipeSizeMm, type EngineeringObject } from '@repo/object-model';
import type { MleMbrInputs } from './inputs';

interface Vec3 { x_mm: number; y_mm: number; z_mm: number }
export interface ModelEquipment {
  id: string; tag: string; equipmentId: string; description: string; type: string; category: string;
  vendor: string; model: string;
  dutyParameters: Record<string, number | string>;
  dimensions: Record<string, number | undefined>;
  position: { x_mm: number; y_mm: number; z_mm: number; orientation_deg: number };
  parent_tank?: string; parent_container?: string;
  nozzles: Array<{ id: string; service: string; size_mm: number; face: string; elevation_mm: number; flange_standard: string }>;
  connections: Array<{ type: string; to_equipment: string; to_nozzle: string; pipe_id: string }>;
  internals: string[];
  accessories: string[];
  maintenance_clearance: { N_mm: number; S_mm: number; E_mm: number; W_mm: number };
  civil_notes: string;
  standards_compliance: Array<{ check: string; status: string; note?: string }>;
}
export interface ModelPipe {
  id: string; service: string; fluid: string;
  from_equipment: string; from_nozzle: string; to_equipment: string; to_nozzle: string;
  flow_m3hr: number; pipe_size_mm: number; velocity_ms: number;
  material: string; pressure_class: string;
  waypoints: Vec3[];
  fittings: Array<{ type: string; position_index: number }>;
  insulation: string; colour_code: string;
}
export interface ModelLayout {
  site_boundary: { L_mm: number; W_mm: number };
  container?: { id: string; position: Vec3; orientation_deg: number; internal_L_mm: number; internal_W_mm: number };
  hardstand: { base: string; surface: string; fall: string };
  access_points: Array<{ from: string; direction: string }>;
  maintenance_zones: Array<{ equipmentId: string; clearance_mm: number; side: string }>;
  drainage: { fall_direction: string; to: string };
  pipe_corridors: Array<{ id: string; centreline: Vec3[] }>;
}
export interface ModelJson {
  schema: 'aquasim.model/1';
  equipment: ModelEquipment[];
  pipework: ModelPipe[];
  layout: ModelLayout;
}

const MM = (m: number): number => Math.round(m * 1000);
const round = (x: number, dp = 2): number => { const f = 10 ** dp; return Math.round(x * f) / f; };

const FLUID = {
  water: { material: 'uPVC Class 12', pressure: 'PN12', colour: 'blue', velocity: 1.0 },
  pressureWater: { material: 'uPVC Class 12', pressure: 'PN12', colour: 'blue', velocity: 1.5 },
  air: { material: 'SS304 / galvanised', pressure: 'PN6', colour: 'green', velocity: 15 },
  chemical: { material: 'PVDF', pressure: 'PN16', colour: 'yellow', velocity: 1.0 },
  sludge: { material: 'HDPE', pressure: 'PN10', colour: 'brown', velocity: 1.2 },
} as const;

/** Flow (m³/h) carried by a connection, from the source object + the design. */
function flowFor(source: EngineeringObject, medium: string, design: MleMbrDesign): number {
  if (medium === 'air') return source.params.kind === 'blower' ? source.params.airFlowAm3H.value : design.aeration.processAirAm3h;
  if (medium === 'chemical') return Math.max(0.001, design.utilities.naoclLPerHour / 1000);
  if (medium === 'sludge') return Math.max(0.1, design.solids.wasM3d / 24);
  if (source.params.kind === 'pump') return source.params.dutyFlowM3H.value;
  return round(design.flows.pwwf / 24); // gravity main at peak wet weather
}

function dutyParamsOf(o: EngineeringObject): Record<string, number | string> {
  const p = o.params;
  switch (p.kind) {
    case 'tank': return { function: p.function, volume_m3: p.volumeM3.value, swd_m: p.sideWaterDepthM.value, ...(p.mlssMgL ? { MLSS_mgL: p.mlssMgL.value } : {}), ...(p.diffuserCount ? { diffusers: p.diffuserCount } : {}) };
    case 'pump': return { service: p.service, type: p.pumpType, duty_m3hr: p.dutyFlowM3H.value, head_m: p.headM.value, kW: p.installedKW.value, config: p.configuration };
    case 'blower': return { type: p.blowerType, air_Am3hr: p.airFlowAm3H.value, dP_kPa: p.dischargePressureKpa.value, kW: p.installedKW.value, config: p.configuration };
    case 'dosing_skid': return { chemical: p.chemical, dose_mgL: p.doseMgL.value, daily_kg: p.dailyConsumptionKg.value, storage_days: p.storageDays.value };
    default: {
      const out: Record<string, number | string> = { type: 'equipmentType' in p ? p.equipmentType : p.kind };
      if ('installedKW' in p && p.installedKW) out.kW = p.installedKW.value;
      return out;
    }
  }
}

export function buildModelJson(objects: EngineeringObject[], design: MleMbrDesign, input: MleMbrInputs): ModelJson {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const eqId = (o?: EngineeringObject): string => o?.mechanical?.equipmentId ?? o?.tag ?? 'UNKNOWN';

  // ---- pipework (one run per connection) ----
  const pipework: ModelPipe[] = [];
  let pipeSeq = 0;
  const pipeIdFor = new Map<string, string>(); // `${from}->${to}` → pipe id
  for (const o of objects) {
    for (const c of o.connections) {
      const t = byId.get(c.toObjectId);
      if (!t) continue;
      const medium = c.medium;
      const fromPump = o.params.kind === 'pump';
      const band = medium === 'water' ? (fromPump ? FLUID.pressureWater : FLUID.water) : FLUID[medium as keyof typeof FLUID] ?? FLUID.water;
      const flow = flowFor(o, medium, design);
      const minMm = medium === 'sludge' ? 50 : 25;
      const dn = pipeSizeMm(flow, band.velocity, minMm);
      const area = Math.PI * (dn / 2000) ** 2;
      const velocity = round(flow / 3600 / area, 3);
      const id = `P-${String(++pipeSeq).padStart(3, '0')}`;
      pipeIdFor.set(`${o.id}->${t.id}`, id);
      const fromN = o.mechanical?.nozzles.find((n) => /out|perm|disch|air|dose/i.test(n.service))?.id ?? 'N1';
      const toN = c.toPort;
      const z = 300;
      const fx = MM(o.placement.location.x), fy = MM(o.placement.location.y);
      const tx = MM(t.placement.location.x), ty = MM(t.placement.location.y);
      const waypoints: Vec3[] = [{ x_mm: fx, y_mm: fy, z_mm: z }, { x_mm: tx, y_mm: fy, z_mm: z }, { x_mm: tx, y_mm: ty, z_mm: z }];
      const fittings = fx !== tx && fy !== ty ? [{ type: 'elbow-90', position_index: 1 }] : [];
      pipework.push({
        id, service: medium, fluid: medium, from_equipment: eqId(o), from_nozzle: fromN, to_equipment: eqId(t), to_nozzle: toN,
        flow_m3hr: round(flow), pipe_size_mm: dn, velocity_ms: velocity, material: band.material, pressure_class: band.pressure,
        waypoints, fittings, insulation: 'none', colour_code: band.colour,
      });
    }
  }

  // ---- equipment ----
  const equipment: ModelEquipment[] = objects.map((o) => {
    const m = o.mechanical;
    const internals = objects.filter((x) => x.ext?.parentId === o.id).map((x) => eqId(x));
    return {
      id: o.id, tag: o.tag, equipmentId: eqId(o), description: o.label, type: o.class, category: o.discipline,
      vendor: m?.vendor ?? 'Best available', model: m?.model ?? o.label,
      dutyParameters: dutyParamsOf(o),
      dimensions: m?.dimensionsMm ?? {},
      position: { x_mm: MM(o.placement.location.x), y_mm: MM(o.placement.location.y), z_mm: MM(o.placement.location.z), orientation_deg: o.placement.rotationDeg },
      ...(o.ext?.parentId ? { parent_tank: eqId(byId.get(o.ext.parentId as string)) } : {}),
      ...(o.ext?.parentContainer ? { parent_container: eqId(byId.get(o.ext.parentContainer as string)) } : {}),
      nozzles: (m?.nozzles ?? []).map((n) => ({ id: n.id, service: n.service, size_mm: n.sizeMm, face: n.face, elevation_mm: n.elevationMm, flange_standard: n.flangeStandard })),
      connections: o.connections.map((c) => ({ type: c.medium, to_equipment: eqId(byId.get(c.toObjectId)), to_nozzle: c.toPort, pipe_id: pipeIdFor.get(`${o.id}->${c.toObjectId}`) ?? '' })),
      internals,
      accessories: m?.accessories ?? [],
      maintenance_clearance: m?.clearance ?? { N_mm: 0, S_mm: 0, E_mm: 0, W_mm: 0 },
      civil_notes: o.placement.location.z < 0 ? 'Set in-ground; top at FFL ±150 mm; flotation check + puddle flanges at all penetrations.' : (o.class === 'tank' || o.class === 'reactor') ? 'On RC plinth +150 mm above FFL; 50 mm cover to the wastewater face; sump at the low point, 1:50 floor fall.' : 'Equipment plinth +100 mm above hardstand; SS316 fasteners.',
      standards_compliance: (m?.standardsCompliance ?? []).map((s) => ({ check: s.check, status: s.status, ...(s.note ? { note: s.note } : {}) })),
    };
  });

  // ---- layout object ----
  const container = objects.find((o) => o.class === 'building');
  const tanks = objects.filter((o) => o.class === 'tank' || o.class === 'reactor');
  const corridorY = tanks.length ? MM(Math.min(...tanks.map((t) => t.placement.location.y)) - 2) : 0;
  const corridorX0 = tanks.length ? MM(Math.min(...tanks.map((t) => t.placement.location.x)) - 2) : 0;
  const corridorX1 = tanks.length ? MM(Math.max(...tanks.map((t) => t.placement.location.x)) + 2) : MM(input.footprintLengthM);
  const layout: ModelLayout = {
    site_boundary: { L_mm: MM(input.footprintLengthM), W_mm: MM(input.footprintWidthM) },
    ...(container ? { container: { id: eqId(container), position: { x_mm: MM(container.placement.location.x), y_mm: MM(container.placement.location.y), z_mm: MM(container.placement.location.z) }, orientation_deg: container.placement.rotationDeg, internal_L_mm: MM(container.geometry.footprint.lengthM), internal_W_mm: MM(container.geometry.footprint.widthM) } } : {}),
    hardstand: { base: '150 mm crushed-stone base', surface: '80 mm concrete paving', fall: '1:100 away from structures' },
    access_points: [{ from: input.meta.siteLocation || 'site road (south edge)', direction: 'north into the plant' }],
    maintenance_zones: objects.filter((o) => o.mechanical && o.class !== 'building').map((o) => ({ equipmentId: eqId(o), clearance_mm: Math.max(o.mechanical!.clearance.N_mm, o.mechanical!.clearance.S_mm, o.mechanical!.clearance.E_mm, o.mechanical!.clearance.W_mm), side: 'N (primary access)' })),
    drainage: { fall_direction: '1:100 to the plant inlet', to: 'buffer / equalisation tank' },
    pipe_corridors: [{ id: 'PC-01', centreline: [{ x_mm: corridorX0, y_mm: corridorY, z_mm: 0 }, { x_mm: corridorX1, y_mm: corridorY, z_mm: 0 }] }],
  };

  return { schema: 'aquasim.model/1', equipment, pipework, layout };
}
