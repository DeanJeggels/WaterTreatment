import type { Database } from './database.types';
import type { BoQLineItem, AggregatedBoQ } from '@repo/sim-engine';

/**
 * Phase 4 smoke test — type-level only. Proves the Supabase types compile
 * alongside the sim-engine BoQ types, and the shapes line up.
 *
 * Phase 7 replaces this with real read/write functions.
 */
type DbBoqRow = Database['public']['Tables']['boq_line_items']['Row'];
type DbBoqInsert = Database['public']['Tables']['boq_line_items']['Insert'];
type DbProposalRow = Database['public']['Tables']['project_proposals']['Row'];

// Shape check: a BoQLineItem from sim-engine should be mappable to a DB insert.
function _typeCheckBoqInsert(item: BoQLineItem, flowsheetId: string, nodeId: string): DbBoqInsert {
  return {
    flowsheet_id: flowsheetId,
    unit_node_id: nodeId,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price_zar: item.unitPriceZar,
    source_citation: item.sourceCitation,
    override_reason: item.overrideReason ?? null,
  };
}

// Shape check: a DB row should be readable in the same shape (reverse of above).
function _typeCheckBoqRead(row: DbBoqRow): { description: string; total: number } {
  return {
    description: row.description,
    total: Number(row.total_price_zar),  // numeric comes back as string from PG
  };
}

// Shape check: a proposal snapshot holds the aggregated BoQ shape.
function _typeCheckProposalSnapshot(agg: AggregatedBoQ): DbProposalRow['snapshot'] {
  return agg as unknown as DbProposalRow['snapshot'];
}

// Silence unused warnings by exporting as a namespace (type-level only)
export type _Phase4TypeChecks = {
  insert: typeof _typeCheckBoqInsert;
  read: typeof _typeCheckBoqRead;
  proposalSnapshot: typeof _typeCheckProposalSnapshot;
};
