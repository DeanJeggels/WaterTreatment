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
  siteLocalCoordinateSystem,
  parseDesignPackage,
  type DesignPackage,
  type EngineeringObject,
} from '@repo/object-model';
import { layout, rectangularSite } from '@repo/layout-engine';
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
  const objects = instantiateMleMbr(design, { flowsheetId: meta.flowsheetId });

  // The MBR cassette lives INSIDE the aeration tank — keep it out of the plot
  // packing, then snap it to the parent's footprint after layout.
  const cassette = objects.find((o) => o.ext?.insideParent);
  const placeable = objects.filter((o) => o !== cassette);
  const site = input.siteBoundary?.length ? { boundary: input.siteBoundary } : rectangularSite(input.siteAreaM2);
  const plantLayout = layout(placeable, site);
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
    TSS: 2, // MBR permeate
    COD: 40, // MBR permeate (typical)
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
  };

  return { design, objects, package: parseDesignPackage(pkg) };
}
