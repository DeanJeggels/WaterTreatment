/**
 * assembleDesignPackage (stage 8) — builds the canonical DesignPackage (§6) and
 * validates it with object-model's designPackageSchema before returning, so the
 * persisted JSON is always contract-valid. Pure + deterministic: `generatedAt`
 * is passed in (stamped by apps/web), never read from a clock here.
 */
import {
  SCHEMA_VERSION,
  siteLocalCoordinateSystem,
  parseDesignPackage,
  type DesignPackage,
  type CalculationRecord,
} from '@repo/object-model';
import type { AutoDesignRunResult } from './run';

export interface AssembleMeta {
  projectId: string;
  flowsheetId: string;
  /** ISO timestamp — stamped by the caller so assemble stays deterministic. */
  generatedAt: string;
  simEngineVersion?: string;
  layoutVersion?: string;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export function assembleDesignPackage(run: AutoDesignRunResult, meta: AssembleMeta): DesignPackage {
  const input = run.inputs;

  // Totals — read off the already-sized/placed objects, never recomputed.
  let installedKW = 0;
  for (const o of run.objects) {
    const p = o.params;
    if ((p.kind === 'blower' || p.kind === 'pump') && p.installedKW) installedKW += p.installedKW.value;
    else if ((p.kind === 'equipment' || p.kind === 'screen') && p.installedKW) installedKW += p.installedKW.value;
  }
  const footprintM2 = run.objects.reduce(
    (s, o) => s + o.geometry.footprint.lengthM * o.geometry.footprint.widthM,
    0,
  );

  const calculations: CalculationRecord[] = run.objects.flatMap((o) => o.sourceCalc?.records ?? []);

  const perParameter: Record<string, { target: number; predicted: number; pass: boolean }> = {};
  for (const [k, v] of Object.entries(run.compliance.perParameter)) {
    perParameter[k] = { target: v.limit, predicted: v.value, pass: v.pass };
  }

  const pkg: DesignPackage = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      projectId: meta.projectId,
      flowsheetId: meta.flowsheetId,
      projectName: input.meta.projectName,
      ...(input.meta.client ? { client: input.meta.client } : {}),
      ...(input.meta.siteLocation ? { siteLocation: input.meta.siteLocation } : {}),
      plantType: input.plantType,
      generatedAt: meta.generatedAt,
      engine: { simEngine: meta.simEngineVersion ?? '0.1.0', layout: meta.layoutVersion ?? '1.0.0' },
    },
    coordinateSystem: siteLocalCoordinateSystem({
      description: input.meta.siteLocation || 'SW site setting-out peg',
    }),
    inputs: input as unknown as Record<string, unknown>,
    basis: {
      dischargeStandard: input.effluentTargets as unknown as Record<string, unknown>,
      influentBasis: {
        COD: input.influent.COD,
        sCOD: input.influent.sCOD,
        TKN: input.influent.TKN,
        NH3N: input.influent.NH3N,
        TP: input.influent.TP,
        TSS: input.influent.TSS,
      },
      designFlows: {
        adwf: input.designFlowM3d,
        awwf: round2(input.designFlowM3d * input.peakFactor),
        pwwf: round2(input.designFlowM3d * input.peakFactor),
      },
    },
    graph: {
      nodes: run.graph.nodes.map((n) => ({
        id: n.id,
        unitType: n.data.unitType,
        label: n.data.label,
        parameters: n.data.parameters,
        position: n.data.position,
      })),
      edges: run.graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    },
    objects: run.objects,
    layout: run.layout,
    boq: {
      grandTotalZar: run.boq.grandTotal,
      lineItemsByCategory: run.boq.lineItemsByCategory as unknown as Record<string, unknown[]>,
    },
    compliance: {
      standard: run.compliance.standard,
      pass: run.compliance.pass,
      perParameter,
    },
    totals: {
      capexZar: run.boq.grandTotal,
      installedKW: round2(installedKW),
      footprintM2: round2(footprintM2),
    },
    provenance: {
      calculations,
      layoutRules: 'CH-ISE v1',
    },
  };

  // Validate against the published contract before returning (returns the
  // normalized, schema-valid object).
  return parseDesignPackage(pkg);
}
