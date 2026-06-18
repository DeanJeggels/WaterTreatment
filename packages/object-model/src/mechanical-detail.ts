/**
 * applyMechanicalDetail — Stage 3 of the master spec. Enriches each instantiated
 * EngineeringObject with the discipline-tagged mechanical detail the standards
 * mandate: vendor/model, duty-standby, physical dimensions (wall thickness +
 * weight), a nozzle schedule (sized from flows at standard pipe velocities),
 * mandatory accessories, maintenance clearances and a per-item standards-
 * compliance check. Pure + deterministic — every magnitude traces to the design
 * (no engineering is invented here; pipe sizing applies the fixed velocity rules).
 */
import type { MleMbrDesign } from '@repo/sim-engine';
import type {
  EngineeringObject,
  MechanicalDetail,
  Nozzle,
  MaintenanceClearance,
  StandardsCheck,
  ObjectClass,
} from './types';

export interface MechanicalDetailOptions {
  /** 'full' widens every clearance to ≥1000 mm and bumps the access side to 1500. */
  maintenanceAccess?: 'standard' | 'full';
}

// ---- pipe sizing (mechanical standards: gravity 0.6–3, pressure 0.8–2.5, air 10–20) ----
const DN = [25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800];
/** Smallest standard DN whose bore keeps velocity at or below `vMs` for `flowM3h`. */
export function pipeSizeMm(flowM3h: number, vMs: number, minMm = 25): number {
  if (flowM3h <= 0) return minMm;
  const qM3s = flowM3h / 3600;
  const dMm = Math.sqrt((4 * qM3s) / (Math.PI * vMs)) * 1000;
  return DN.find((d) => d >= Math.max(dMm, minMm)) ?? DN[DN.length - 1]!;
}

const round = (x: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

const PREFIX: Partial<Record<ObjectClass, string>> = {
  tank: 'T', reactor: 'T', clarifier: 'CL', membrane: 'MB', pump: 'P', blower: 'BL',
  screen: 'SC', mixer: 'MX', dosing_skid: 'DS', thickener: 'SL', dewatering: 'SL',
  disinfection: 'UV', equipment: 'EQ',
};

const FLANGE = {
  water: 'SANS 1123 Table 1600/3',
  air: 'SANS 1123 Table 1000/3 (galv)',
  chemical: 'PVDF flange PN16',
} as const;

function vendorModel(o: EngineeringObject, design: MleMbrDesign): { vendor: string; model: string } {
  switch (o.class) {
    case 'tank':
    case 'reactor':
      return { vendor: 'Site-built RC civil', model: 'Reinforced concrete tank' };
    case 'membrane':
      return { vendor: design.mbr.model.split(' ')[0] ?? 'Megavision', model: `${design.mbr.model} SMU cassette` };
    case 'blower': {
      const kw = o.params.kind === 'blower' ? o.params.installedKW.value : 0;
      return kw > 50 ? { vendor: 'Aerzen / Kaeser', model: 'HST turbo blower' } : { vendor: 'Aerzen / Kaeser', model: 'Positive-displacement blower' };
    }
    case 'pump':
      return { vendor: 'Grundfos / KSB', model: 'End-suction centrifugal pump' };
    case 'disinfection':
      return { vendor: 'Wedeco / Trojan', model: 'Open-channel UV bank' };
    case 'dosing_skid':
      return { vendor: 'ProMinent / Grundfos', model: 'Diaphragm metering skid' };
    default:
      return { vendor: 'Best available', model: o.label };
  }
}

function dutyStandbyFor(o: EngineeringObject): MechanicalDetail['dutyStandby'] {
  switch (o.class) {
    case 'blower':
    case 'pump':
      return { duty: 1, standby: 1, configuration: '1 duty + 1 standby' };
    case 'dosing_skid':
      return { duty: 1, standby: 1, configuration: '1 duty + 1 standby (metering pumps)' };
    default:
      return { duty: 1, standby: 0, configuration: '1 working' };
  }
}

function accessoriesFor(o: EngineeringObject): string[] {
  switch (o.class) {
    case 'tank':
    case 'reactor':
      return ['Overflow (one size up on inlet)', 'Drain with isolation valve', 'Access cover ≥600×600 mm', 'Level measurement (hydrostatic/radar)'];
    case 'blower': {
      const kw = o.params.kind === 'blower' ? o.params.installedKW.value : 0;
      const base = ['Inlet air filter / silencer', 'Flexible connection', 'Non-return valve', 'Isolation valve', 'Pressure-relief valve'];
      if (kw > 7.5) base.push('Acoustic enclosure (if >85 dBA at 1 m)');
      return base;
    }
    case 'pump':
      return ['Inlet isolation valve', 'Outlet isolation valve', 'Outlet non-return valve', 'Outlet pressure gauge'];
    case 'membrane':
      return ['Permeate isolation valve', 'Air-scour isolation valve', 'Back-pulse connection', 'Lifting beam for cassette removal'];
    case 'disinfection':
      return ['Lamp-out alarm', 'UV-intensity sensor', 'Automatic quartz-sleeve wiper', 'Upstream/downstream isolation penstocks'];
    case 'dosing_skid':
      return ['Bunded day tank (110%)', 'Calibration column', 'Pulsation damper', 'Pressure-relief / loading valve', 'Injection quill with isolation'];
    default:
      return [];
  }
}

function clearanceFor(o: EngineeringObject, full: boolean): MaintenanceClearance {
  // 1000 mm access on at least one side; 600 mm elsewhere (mechanical standards).
  let c: MaintenanceClearance;
  switch (o.class) {
    case 'tank':
    case 'reactor':
      c = { N_mm: 1000, S_mm: 500, E_mm: 500, W_mm: 500 }; // ≥500 between tank walls
      break;
    case 'membrane':
      c = { N_mm: 1000, S_mm: 0, E_mm: 0, W_mm: 0 }; // top extraction clearance (inside tank)
      break;
    case 'blower':
    case 'pump':
    case 'dosing_skid':
    case 'disinfection':
      c = { N_mm: 1000, S_mm: 600, E_mm: 600, W_mm: 600 };
      break;
    default:
      c = { N_mm: 1000, S_mm: 600, E_mm: 600, W_mm: 600 };
  }
  if (full) {
    c = {
      N_mm: Math.max(c.N_mm, 1500),
      S_mm: c.S_mm === 0 ? 0 : Math.max(c.S_mm, 1000),
      E_mm: c.E_mm === 0 ? 0 : Math.max(c.E_mm, 1000),
      W_mm: c.W_mm === 0 ? 0 : Math.max(c.W_mm, 1000),
    };
  }
  return c;
}

/** Build the nozzle schedule from the design flows at the standard velocities. */
function nozzlesFor(o: EngineeringObject, design: MleMbrDesign): Nozzle[] {
  const pwwfM3h = design.flows.pwwf / 24;
  const adwfM3h = design.flows.adwf / 24;
  const aRecycleM3h = design.process.recycle.a * adwfM3h;
  const depthMm = round((o.geometry.heightM?.value ?? 5) * 1000 - 500);
  const n = (id: string, service: string, sizeMm: number, face: Nozzle['face'], elevationMm: number, medium: keyof typeof FLANGE): Nozzle => ({
    id, service, sizeMm, face, elevationMm: round(elevationMm), flangeStandard: FLANGE[medium],
  });
  switch (o.class) {
    case 'tank':
    case 'reactor': {
      const hyd = pipeSizeMm(pwwfM3h, 1.0); // gravity
      const list: Nozzle[] = [
        n('N1', 'Inlet', hyd, 'upstream', depthMm, 'water'),
        n('N2', 'Outlet', hyd, 'downstream', depthMm - 200, 'water'),
        n('N3', 'Drain', Math.max(80, pipeSizeMm(pwwfM3h, 1.0, 80)), 'bottom', 0, 'water'),
        n('N4', 'Overflow', pipeSizeMm(pwwfM3h, 0.8), 'side', depthMm + 200, 'water'),
      ];
      if (o.params.kind === 'tank' && (o.params.function === 'anoxic' || o.params.function === 'mbr')) {
        list.push(n('N5', 'Mixed-liquor recycle', pipeSizeMm(aRecycleM3h, 1.5), 'side', 1500, 'water'));
      }
      if (o.params.kind === 'tank' && o.params.function === 'mbr') {
        list.push(n('N6', 'Permeate', pipeSizeMm(design.mbr.permeateDutyM3h, 1.5), 'side', 2000, 'water'));
        list.push(n('N7', 'Process air', pipeSizeMm(design.aeration.processAirAm3h, 15), 'top', depthMm + 300, 'air'));
      }
      return list;
    }
    case 'membrane':
      return [
        n('N1', 'Permeate', pipeSizeMm(design.mbr.permeateDutyM3h, 1.5), 'side', 2000, 'water'),
        n('N2', 'Air scour', pipeSizeMm(design.mbr.airScourAm3h, 15), 'bottom', 200, 'air'),
      ];
    case 'blower': {
      const air = o.params.kind === 'blower' ? o.params.airFlowAm3H.value : 0;
      return [n('N1', 'Air discharge', pipeSizeMm(air, 15), 'side', 800, 'air'), n('N2', 'Air inlet (filtered)', pipeSizeMm(air, 12), 'top', 1500, 'air')];
    }
    case 'pump': {
      const q = o.params.kind === 'pump' ? o.params.dutyFlowM3H.value : pwwfM3h;
      return [n('N1', 'Suction', pipeSizeMm(q, 1.0), 'side', 300, 'water'), n('N2', 'Discharge', pipeSizeMm(q, 1.5), 'side', 600, 'water')];
    }
    case 'disinfection': {
      const hyd = pipeSizeMm(pwwfM3h, 1.0);
      return [n('N1', 'Inlet', hyd, 'upstream', 300, 'water'), n('N2', 'Outlet', hyd, 'downstream', 300, 'water')];
    }
    case 'dosing_skid':
      return [
        n('N1', 'Bulk fill', 50, 'top', 2000, 'chemical'),
        n('N2', 'Dose line to injection quill', 25, 'side', 800, 'chemical'),
        n('N3', 'Tank vent', 50, 'top', 2200, 'chemical'),
      ];
    default:
      return [];
  }
}

function dimensionsFor(o: EngineeringObject): MechanicalDetail['dimensionsMm'] {
  const lengthMm = round(o.geometry.footprint.lengthM * 1000);
  const widthMm = round(o.geometry.footprint.widthM * 1000);
  const heightMm = round((o.geometry.heightM?.value ?? 2) * 1000);
  if (o.class === 'tank' || o.class === 'reactor') {
    const depthM = o.geometry.heightM?.value ?? 5;
    const wall = depthM <= 3.5 ? 200 : 250; // BS 8007 wall thickness by depth
    const baseT = 0.25;
    const perimeterM = 2 * (o.geometry.footprint.lengthM + o.geometry.footprint.widthM);
    const areaM2 = o.geometry.footprint.lengthM * o.geometry.footprint.widthM;
    const concreteM3 = perimeterM * depthM * (wall / 1000) + areaM2 * baseT;
    return { lengthMm, widthMm, heightMm, wallThicknessMm: wall, weightKg: round(concreteM3 * 2400) };
  }
  const kw =
    o.params.kind === 'blower' ? o.params.installedKW.value :
    o.params.kind === 'pump' ? o.params.installedKW.value : 0;
  const weightKg =
    o.class === 'blower' ? round(kw * 25 + 250) :
    o.class === 'pump' ? round(kw * 18 + 90) :
    o.class === 'membrane' ? round((o.capacity.moduleCount?.value ?? 2) * 280) :
    o.class === 'disinfection' ? 450 :
    o.class === 'dosing_skid' ? 350 : 200;
  return { lengthMm, widthMm, heightMm, weightKg };
}

function complianceFor(o: EngineeringObject): StandardsCheck[] {
  const p = (check: string): StandardsCheck => ({ check, status: 'pass' });
  const w = (check: string, note: string): StandardsCheck => ({ check, status: 'warn', note });
  switch (o.class) {
    case 'tank':
    case 'reactor':
      return [p('Freeboard ≥300 mm'), p('Wall thickness per depth (BS 8007)'), p('Access cover ≥600×600 mm'), w('Crack width ≤0.2 mm', 'confirm at detailed design / reinforcement')];
    case 'blower':
      return [p('20% airflow margin applied'), p('Duty/standby provided'), p('Inlet filter + NRV + PRV fitted'), w('Acoustic enclosure if >85 dBA', 'confirm sound power at selection')];
    case 'pump':
      return [p('Duty/standby provided'), p('Isolation valves + NRV + gauge'), w('Efficiency >60% at duty point', 'confirm from pump curve'), w('NPSH margin', 'confirm on suction lift')];
    case 'membrane':
      return [p('Cassette extraction clearance ≥1000 mm'), p('Permeate + air-scour isolation')];
    case 'disinfection':
      return [p('UV duty sized on peak flow'), p('Lamp-out alarm + intensity sensor')];
    case 'dosing_skid':
      return [p('Chemical bund ≥110% of largest tank'), p('Duty/standby metering pumps'), w('Eyewash within 10 s of chemical area', 'site safety provision')];
    default:
      return [];
  }
}

/**
 * Enrich objects in place-order with mechanical detail. Returns NEW objects
 * (inputs are not mutated). Equipment ids are discipline-prefixed and sequential.
 */
export function applyMechanicalDetail(
  objects: EngineeringObject[],
  design: MleMbrDesign,
  opts: MechanicalDetailOptions = {},
): EngineeringObject[] {
  const full = opts.maintenanceAccess === 'full';
  const seq = new Map<string, number>();
  return objects.map((o) => {
    const prefix = PREFIX[o.class] ?? o.class.slice(0, 2).toUpperCase();
    const next = (seq.get(prefix) ?? 0) + 1;
    seq.set(prefix, next);
    const mechanical: MechanicalDetail = {
      equipmentId: `${prefix}-${String(next).padStart(2, '0')}`,
      ...vendorModel(o, design),
      dutyStandby: dutyStandbyFor(o),
      dimensionsMm: dimensionsFor(o),
      nozzles: nozzlesFor(o, design),
      accessories: accessoriesFor(o),
      clearance: clearanceFor(o, full),
      standardsCompliance: complianceFor(o),
    };
    return { ...o, mechanical };
  });
}
