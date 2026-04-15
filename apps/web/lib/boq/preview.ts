import { aggregateBoQ } from '@repo/sim-engine';
import type { FlowsheetNodeLite, ProcessResult, AggregatedBoQ } from '@repo/sim-engine';

/**
 * Thin wrapper that Phase 6/7 will build the proposal-view BoQ section on top of.
 * Exists in Phase 3 only to smoke-test the import path from apps/web.
 */
export function previewBoQ(
  nodes: FlowsheetNodeLite[],
  nodeResults: Record<string, ProcessResult>,
): AggregatedBoQ {
  return aggregateBoQ(nodes, nodeResults);
}
