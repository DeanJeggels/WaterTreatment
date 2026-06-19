/**
 * runMleMbr — the MLE-MBR design path. Maps the small input set to the
 * deterministic engine (designMleMbr), instantiates EngineeringObjects (MBR
 * cassette nested in the aeration tank), lays out the plot (reusing
 * layout-engine), and assembles a contract-valid DesignPackage carrying the full
 * design for the report. Pure + deterministic (generatedAt is passed in).
 */
import { designMleMbr, type MleMbrBasis, type MleMbrDesign } from '@repo/sim-engine';
import { getDwaLimits } from '@repo/design-library';
import {
  instantiateMleMbr,
  applyMechanicalDetail,
  siteLocalCoordinateSystem,
  parseDesignPackage,
  type DesignPackage,
  type EngineeringObject,
  type PlantLayout,
} from '@repo/object-model';
import { zones } from '@repo/layout-engine';
import { optimiseLayout } from './optimise-layout';
import { buildModelJson } from './build-model-json';
import type { MleMbrInputs } from './inputs';

export interface MleMbrRunMeta {
  projectId: string;
  flowsheetId: string;
  generatedAt: string;
  simEngineVersion?: string;
  layoutVersion?: string;
}

export interface MleMbrRunResult {
  design: MleMbrDesign;
  objects: EngineeringObject[];
  package: DesignPackage;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

function toBasis(input: MleMbrInputs): MleMbrBasis {
  return {
    adwfM3d: input.adwfM3d,
    codMgL: input.codMgL,
    tminC: input.tminC,
    tmaxC: input.tmaxC,
    elevationM: input.elevationM,
    nitrogenRemoval: input.nitrogenRemoval,
    phosphorusRemoval: input.phosphorusRemoval,
    dischargeStandard: input.dischargeStandard,
    mbrRequired: input.mbrRequired,
    membraneModel: input.membraneModel,
    landUse: input.landUse,
  };
}

export function runMleMbr(input: MleMbrInputs, meta: MleMbrRunMeta): MleMbrRunResult {
  const design = designMleMbr(toBasis(input));
  const base = instantiateMleMbr(design, { flowsheetId: meta.flowsheetId });

  // The MBR cassette lives INSIDE the aeration tank — keep it out of the plot packing.
  const cassette0 = base.find((o) => o.ext?.insideParent);
  const placeable = base.filter((o) => o !== cassette0);
  const L = input.footprintLengthM;
  const W = input.footprintWidthM;
  const site = input.siteBoundary?.length
    ? { boundary: input.siteBoundary }
    : { boundary: [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }] };

  // Stages 4 + 5: arrange (installation-type rules) → optimise (score candidates,
  // pick the best). optimiseLayout sets the selected placements on `placeable`.
  const opt = optimiseLayout(placeable, input, design);
  const withHousing = opt.container ? [...base, opt.container] : base;

  // Stage 3: enrich EVERY object (incl. the housing + cassette) with mechanical detail.
  const objects = applyMechanicalDetail(withHousing, design, { maintenanceAccess: input.maintenanceAccess });
  const cassette = objects.find((o) => o.ext?.insideParent);
  const layoutObjects = objects.filter((o) => o !== cassette);
  const zoneResult = zones(layoutObjects);
  const plantLayout: PlantLayout = {
    siteBoundary: site.boundary,
    corridors: zoneResult.corridors,
    bunds: zoneResult.bunds,
    pipeRoutes: zoneResult.pipeRoutes,
    violations: [
      ...zoneResult.violations,
      ...opt.selected.hardViolations.map((message) => ({ code: 'LAYOUT_HARD', message, severity: 'error' as const })),
    ],
    rulesApplied: [
      ...opt.appliedRules.map((rule) => ({ rule })),
      { rule: `Layout optimisation: selected "${opt.selected.label}" of ${opt.candidates.length} candidate(s) — score ${opt.selected.score}, ${opt.selected.metrics.maintenanceAccess} maintenance access, footprint ${opt.selected.metrics.footprintM2} m² (${opt.selected.metrics.footprintUsedPct}% of plot).`, detail: `weights: ${JSON.stringify(opt.weights)}` },
      ...zoneResult.rulesApplied,
    ],
  };

  // The MBR cassette is snapped to the aeration parent's footprint (nested inside).
  if (cassette) {
    const parent = objects.find((o) => o.id === cassette.ext!.parentId);
    if (parent) {
      cassette.placement = {
        location: { x: parent.placement.location.x, y: parent.placement.location.y, z: 0.5 },
        rotationDeg: parent.placement.rotationDeg,
        zone: 'process',
      };
    }
  }

  // ---- compliance: predicted effluent vs the DWA tier ----
  const limits = getDwaLimits(input.dischargeStandard);
  const predicted: Record<string, number> = {
    NH3N: design.effluent.ammoniaMgL,
    NO3N: design.effluent.nitrateMgL,
    TSS: design.effluent.permeateTssMgL, // MBR permeate (engine-derived)
    COD: design.effluent.permeateCodMgL,
  };
  const perParameter: Record<string, { target: number; predicted: number; pass: boolean }> = {};
  for (const [k, p] of Object.entries(predicted)) {
    const target = (limits as unknown as Record<string, number | undefined>)[k];
    if (target !== undefined) perParameter[k] = { target, predicted: p, pass: p <= target };
  }
  const compliancePass = Object.values(perParameter).every((p) => p.pass);

  const footprintM2 = placeable.reduce((s, o) => s + o.geometry.footprint.lengthM * o.geometry.footprint.widthM, 0);

  const pkg: DesignPackage = {
    schemaVersion: '1.0.0',
    meta: {
      projectId: meta.projectId,
      flowsheetId: meta.flowsheetId,
      projectName: input.meta.projectName,
      ...(input.meta.client ? { client: input.meta.client } : {}),
      ...(input.meta.siteLocation ? { siteLocation: input.meta.siteLocation } : {}),
      plantType: design.mbr.included ? 'MLE-MBR' : design.process.config,
      generatedAt: meta.generatedAt,
      engine: { simEngine: meta.simEngineVersion ?? '0.1.0', layout: meta.layoutVersion ?? '1.0.0' },
    },
    coordinateSystem: siteLocalCoordinateSystem({ description: input.meta.siteLocation || 'SW site setting-out peg' }),
    inputs: input as unknown as Record<string, unknown>,
    basis: {
      dischargeStandard: limits as unknown as Record<string, unknown>,
      influentBasis: {
        COD: design.influent.COD,
        TKN: design.influent.TKN,
        TP: design.influent.TP,
        TSS: design.influent.TSS,
        FSA: design.influent.FSA,
        BOD: design.influent.BOD,
      },
      designFlows: { adwf: design.flows.adwf, awwf: design.flows.awwf, pwwf: design.flows.pwwf },
    },
    graph: {
      nodes: objects.map((o) => ({ id: o.id, unitType: o.class, label: o.label, position: { x: o.placement.location.x, y: o.placement.location.y } })),
      edges: objects.flatMap((o) => o.connections.map((c) => ({ source: o.id, target: c.toObjectId }))),
    },
    objects,
    layout: plantLayout,
    boq: { grandTotalZar: 0, lineItemsByCategory: {} },
    compliance: { standard: input.dischargeStandard === 'Special' ? 'DWA Special' : 'DWA General', pass: compliancePass, perParameter },
    totals: { capexZar: 0, installedKW: design.utilities.installedKW, footprintM2: round2(footprintM2) },
    provenance: { calculations: design.calculationRecords, layoutRules: 'CH-ISE v1' },
    mleMbr: design as unknown as Record<string, unknown>,
    layoutOptions: opt.candidates.map((c) => ({
      key: c.key, label: c.label, arrangementLogic: c.arrangementLogic, score: c.score, valid: c.valid,
      selected: c.key === opt.selected.key,
      pipeLengthM: c.metrics.pipeLengthM, bendCount: c.metrics.bendCount, crossingCount: c.metrics.crossingCount,
      footprintM2: c.metrics.footprintM2, footprintUsedPct: c.metrics.footprintUsedPct, maintenanceAccess: c.metrics.maintenanceAccess,
      tradeoffs: c.tradeoffs, bestForPriority: c.bestForPriority, clearanceCompromises: c.clearanceCompromises,
    })),
    modelJson: buildModelJson(objects, design, input) as unknown as Record<string, unknown>,
  };

  return { design, objects, package: parseDesignPackage(pkg) };
}
