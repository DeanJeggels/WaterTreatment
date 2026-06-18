import { createClient } from '@/lib/supabase/client';
import { runAutoDesign, assembleDesignPackage, runMleMbr, type DesignInputs, type MleMbrInputs } from '@repo/auto-design';
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
  // Carry project-level meta (client, location) to the shared proposal_data so
  // it shows on the Proposal tab too. Merge to preserve other proposal fields.
  const { data: fsRow } = await supabase
    .from('flowsheets')
    .select('proposal_data')
    .eq('id', flowsheetId)
    .maybeSingle();
  const existingProposal = (fsRow?.proposal_data ?? {}) as Record<string, unknown>;
  const existingClient = (existingProposal.client ?? {}) as Record<string, unknown>;
  const mergedProposal = {
    ...existingProposal,
    client: {
      ...existingClient,
      ...(inputs.meta.client ? { name: inputs.meta.client } : {}),
      ...(inputs.meta.siteLocation ? { location: inputs.meta.siteLocation } : {}),
    },
  };

  // Non-fatal: the package is already saved; canvas + proposal seeding is convenience.
  await supabase
    .from('flowsheets')
    .update({ graph_data: graphData, proposal_data: mergedProposal })
    .eq('id', flowsheetId);
  // Keep the project name in sync so the Flowsheet/Proposal headers match.
  if (inputs.meta.projectName) {
    await supabase.from('projects').update({ name: inputs.meta.projectName }).eq('id', projectId);
  }

  return pkg;
}

/**
 * MLE-MBR design path (T: redesign). Runs the deterministic engine + assembles
 * the package (carrying the full design for the report), persists it, and syncs
 * the project name. Supabase touches live ONLY here.
 */
export async function runAndPersistMleMbr(
  projectId: string,
  flowsheetId: string,
  inputs: MleMbrInputs,
): Promise<DesignPackage> {
  const generatedAt = new Date().toISOString();
  const { package: pkg } = runMleMbr(inputs, { projectId, flowsheetId, generatedAt });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('design_packages').upsert(
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
  if (error) throw new Error(error.message);

  if (inputs.meta.projectName) {
    await supabase.from('projects').update({ name: inputs.meta.projectName }).eq('id', projectId);
  }
  return pkg;
}

/** Shared project meta for pre-filling the wizard (client/location live on proposal_data). */
export async function loadProjectMeta(
  flowsheetId: string,
): Promise<{ client?: string; siteLocation?: string }> {
  const supabase = createClient();
  const { data } = await supabase
    .from('flowsheets')
    .select('proposal_data')
    .eq('id', flowsheetId)
    .maybeSingle();
  const client = (data?.proposal_data as { client?: { name?: string; location?: string } } | null)?.client;
  return { client: client?.name, siteLocation: client?.location };
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
