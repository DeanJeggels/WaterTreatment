import type { ProcessResult, UnitType, BoQLineItem, BoQCategory } from '../types';
import { BOQ_CATEGORIES } from '../types';
import { createUnit } from '../units';

/**
 * Minimal shape of a flowsheet node that the BoQ aggregator needs.
 * The full flowsheet structure (graph_data JSON in Supabase) is richer;
 * the aggregator only reads what it needs so it can be called with either
 * a React Flow node object or a simpler in-memory representation.
 */
export interface FlowsheetNodeLite {
  id: string;
  type: UnitType;
  parameters: Record<string, number>;
}

/**
 * Override for a specific line item. Keyed by the line item's description
 * (descriptions are stable within a unit's output because they're generated
 * from the unit's config). An override with `unitPriceZar` set replaces the
 * seeded price; setting `remove` to true drops the line item entirely.
 */
export interface BoQOverride {
  nodeId: string;
  description: string;
  unitPriceZar?: number;
  overrideReason?: string;
  remove?: boolean;
}

export interface AggregatedBoQ {
  /** Line items grouped by category */
  lineItemsByCategory: Record<BoQCategory, Array<BoQLineItem & { nodeId: string }>>;
  /** Category subtotals in ZAR */
  subtotalsByCategory: Record<BoQCategory, number>;
  /** Overall grand total in ZAR */
  grandTotal: number;
  /** How many nodes contributed (including orphans) */
  nodeCount: number;
  /** How many nodes were orphan-iterated (not in nodeResults) */
  orphanCount: number;
}

/**
 * Walks every flowsheet node and aggregates their capex line items into
 * a single, grouped, priced Bill of Quantities. Nodes not found in the
 * provided `nodeResults` (e.g. disconnected utility nodes like the
 * AerationBlower whose O2-demand is supplied via parameters) are
 * executed in isolation via createUnit(...).process([]).
 */
export function aggregateBoQ(
  nodes: FlowsheetNodeLite[],
  nodeResults: Record<string, ProcessResult>,
  overrides: BoQOverride[] = [],
): AggregatedBoQ {
  const byCategory: Record<BoQCategory, Array<BoQLineItem & { nodeId: string }>> = {
    civil: [],
    mechanical: [],
    electrical: [],
    chemicals: [],
    instrumentation: [],
  };

  let orphanCount = 0;

  // Build an index of overrides for fast lookup: key = `${nodeId}::${description}`
  const overrideIndex = new Map<string, BoQOverride>();
  for (const o of overrides) {
    overrideIndex.set(`${o.nodeId}::${o.description}`, o);
  }

  for (const node of nodes) {
    let result = nodeResults[node.id];
    if (!result) {
      try {
        const unit = createUnit(node.type, node.parameters);
        result = unit.process([]);
        orphanCount++;
      } catch {
        continue;
      }
    }

    const items = result.capex?.lineItems ?? [];
    for (const item of items) {
      const key = `${node.id}::${item.description}`;
      const override = overrideIndex.get(key);
      if (override?.remove) continue;

      const effectiveItem: BoQLineItem & { nodeId: string } = {
        ...item,
        nodeId: node.id,
        unitPriceZar: override?.unitPriceZar ?? item.unitPriceZar,
        overrideReason: override?.overrideReason ?? item.overrideReason,
      };

      byCategory[item.category].push(effectiveItem);
    }
  }

  const subtotals: Record<BoQCategory, number> = {
    civil: 0, mechanical: 0, electrical: 0, chemicals: 0, instrumentation: 0,
  };
  let grandTotal = 0;
  for (const category of BOQ_CATEGORIES) {
    const sum = byCategory[category].reduce(
      (acc, item) => acc + item.quantity * item.unitPriceZar,
      0,
    );
    subtotals[category] = sum;
    grandTotal += sum;
  }

  return {
    lineItemsByCategory: byCategory,
    subtotalsByCategory: subtotals,
    grandTotal,
    nodeCount: nodes.length,
    orphanCount,
  };
}
