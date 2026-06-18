import { createClient } from '@/lib/supabase/client';
import { runAutoDesign, assembleDesignPackage, type DesignInputs } from '@repo/auto-design';
import type { DesignPackage } from '@repo/object-model';

/**
 * Client adapter (T5.3). Runs the headless @repo/auto-design pipeline +
 * assembles the canonical DesignPackage, then PERSISTS it (and seeds the manual
 * canvas via flowsheets.graph_data — the escape hatch). Supabase touches live
 * ONLY here; the packages stay DB-free. generatedAt is stamped here (browser
 * clock), keeping the headless assemble deterministic.
 */
export async function runAndPersistDesign(
  projectId: string,
  flowsheetId: string,
  inputs: DesignInputs,
): Promise<DesignPackage> {
  const run = runAutoDesign(inputs, { flowsheetId });
  const generatedAt = new Date().toISOString();
  const pkg = assembleDesignPackage(run, { projectId, flowsheetId, generatedAt });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Persist the package (the JSON source of truth) onto the draft row.
  const { error: pkgErr } = await supabase.from('design_packages').upsert(
    {
      project_id: projectId,
      flowsheet_id: flowsheetId,
      version: 1,
      schema_version: pkg.schemaVersion,
      inputs,
      package: pkg,
      plant_type: pkg.meta.plantType,
      compliance_pass: pkg.compliance.pass,
      generated_by: user.id,
    },
    { onConflict: 'flowsheet_id,version' },
  );
  if (pkgErr) throw new Error(pkgErr.message);

  // Seed the manual canvas with an ordinary React-Flow graph (escape hatch).
  const graphData = {
    nodes: run.graph.nodes.map((n) => ({
      id: n.id,
      type: n.data.unitType,
      position: n.data.position,
      data: { unitType: n.data.unitType, label: n.data.label, parameters: n.data.parameters },
    })),
    edges: run.graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
  // Non-fatal: the package is already saved; canvas seeding is a convenience.
  await supabase.from('flowsheets').update({ graph_data: graphData }).eq('id', flowsheetId);

  return pkg;
}

/** Load the persisted package for a flowsheet (viewer reads the PERSISTED row, not live state). */
export async function loadDesignPackage(flowsheetId: string): Promise<DesignPackage | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('design_packages')
    .select('package')
    .eq('flowsheet_id', flowsheetId)
    .eq('version', 1)
    .maybeSingle();
  if (error || !data?.package) return null;
  return data.package as DesignPackage;
}
