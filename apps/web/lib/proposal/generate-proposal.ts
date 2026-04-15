import type {
  AggregatedBoQ,
  SimulationResults,
  FlowsheetNodeLite,
} from '@repo/sim-engine';
import { createClient } from '@/lib/supabase/client';
import type { ProposalData } from './ProposalDocument';

interface SaveBoqParams {
  flowsheetId: string;
  boq: AggregatedBoQ;
}

/**
 * Replace all existing BoQ rows for the flowsheet with the current aggregation.
 * Delete-then-insert: a flowsheet has O(100) line items at most.
 */
export async function saveBoqLineItems({ flowsheetId, boq }: SaveBoqParams) {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from('boq_line_items')
    .delete()
    .eq('flowsheet_id', flowsheetId);
  if (delErr) throw delErr;

  const rows = Object.values(boq.lineItemsByCategory)
    .flat()
    .map((item) => ({
      flowsheet_id: flowsheetId,
      unit_node_id: item.nodeId,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_zar: item.unitPriceZar,
      source_citation: item.sourceCitation,
      override_reason: item.overrideReason ?? null,
    }));

  if (rows.length === 0) return { count: 0 };

  const { error: insErr } = await supabase.from('boq_line_items').insert(rows);
  if (insErr) throw insErr;
  return { count: rows.length };
}

interface CreateProposalSnapshotParams {
  flowsheetId: string;
  proposalData: ProposalData;
  results: SimulationResults;
  boq: AggregatedBoQ;
  nodes: FlowsheetNodeLite[];
}

/**
 * Insert a new project_proposals row with the next version number.
 * Read-then-write — not atomic, but the (flowsheet_id, version) unique
 * constraint catches races at the DB level.
 */
export async function createProposalSnapshot(params: CreateProposalSnapshotParams) {
  const supabase = createClient();
  const { flowsheetId, proposalData, results, boq, nodes } = params;

  const { data: existing, error: qErr } = await supabase
    .from('project_proposals')
    .select('version')
    .eq('flowsheet_id', flowsheetId)
    .order('version', { ascending: false })
    .limit(1);
  if (qErr) throw qErr;

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const snapshot = {
    proposal_data: proposalData,
    nodes,
    node_results: results.nodeResults,
    boq,
  };

  const { error: insErr } = await supabase.from('project_proposals').insert({
    flowsheet_id: flowsheetId,
    generated_by: user?.id ?? null,
    version: nextVersion,
    // Json column accepts any serializable structure
    snapshot: snapshot as never,
  });
  if (insErr) throw insErr;

  return { version: nextVersion };
}
