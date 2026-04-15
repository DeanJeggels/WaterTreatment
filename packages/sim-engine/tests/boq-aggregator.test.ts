import { describe, it, expect } from 'vitest';
import { aggregateBoQ } from '../src/boq/aggregator';
import type { FlowsheetNodeLite } from '../src/boq/aggregator';
import type { ProcessResult, BoQCategory } from '../src/types';

const mkItem = (category: BoQCategory, qty: number, price: number, description: string) => ({
  category,
  description,
  quantity: qty,
  unit: 'ea',
  unitPriceZar: price,
  sourceCitation: 'test',
});

describe('aggregateBoQ', () => {
  it('returns empty totals for empty input', () => {
    const result = aggregateBoQ([], {});
    expect(result.grandTotal).toBe(0);
    expect(result.nodeCount).toBe(0);
    expect(result.orphanCount).toBe(0);
    expect(result.subtotalsByCategory.civil).toBe(0);
  });

  it('groups line items by category and computes subtotals + grand total', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: {
          lineItems: [
            mkItem('civil', 100, 18000, 'concrete tank'),
            mkItem('mechanical', 1, 280000, 'scraper bridge'),
          ],
          total: 2_080_000,
        },
      } as ProcessResult,
    };

    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.subtotalsByCategory.civil).toBe(1_800_000);
    expect(result.subtotalsByCategory.mechanical).toBe(280_000);
    expect(result.grandTotal).toBe(2_080_000);
    expect(result.lineItemsByCategory.civil.length).toBe(1);
    expect(result.lineItemsByCategory.mechanical.length).toBe(1);
    expect(result.orphanCount).toBe(0);
  });

  it('handles orphan utility nodes by calling createUnit(...).process([])', () => {
    // AerationBlower is a utility node with no input/output streams.
    // Even though simulate() doesn't visit it (nodeResults is empty), the
    // aggregator must call createUnit and include its BoQ.
    const nodes: FlowsheetNodeLite[] = [
      { id: 'blower1', type: 'aeration_blower', parameters: { o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 } },
    ];
    const result = aggregateBoQ(nodes, {});
    expect(result.orphanCount).toBe(1);
    expect(result.grandTotal).toBeGreaterThan(0);
    expect(result.lineItemsByCategory.mechanical.length).toBeGreaterThan(0);
  });

  it('mixes connected + orphan nodes correctly', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
      { id: 'blower1', type: 'aeration_blower', parameters: { o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 } },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('civil', 100, 18000, 'concrete')], total: 1_800_000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.nodeCount).toBe(2);
    expect(result.orphanCount).toBe(1);
    expect(result.grandTotal).toBeGreaterThan(1_800_000);
  });

  it('applies unitPriceZar overrides', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('mechanical', 1, 280000, 'scraper bridge')], total: 280000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults, [
      { nodeId: 'n1', description: 'scraper bridge', unitPriceZar: 250000, overrideReason: 'negotiated discount' },
    ]);
    expect(result.lineItemsByCategory.mechanical[0]!.unitPriceZar).toBe(250000);
    expect(result.lineItemsByCategory.mechanical[0]!.overrideReason).toBe('negotiated discount');
    expect(result.grandTotal).toBe(250000);
  });

  it('removes line items when override.remove = true', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: {
          lineItems: [
            mkItem('civil', 100, 18000, 'concrete'),
            mkItem('mechanical', 1, 280000, 'scraper bridge'),
          ],
          total: 2080000,
        },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults, [
      { nodeId: 'n1', description: 'scraper bridge', remove: true },
    ]);
    expect(result.lineItemsByCategory.mechanical.length).toBe(0);
    expect(result.grandTotal).toBe(1_800_000);
  });

  it('survives a node with no capex contribution (e.g. Influent)', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'inf', type: 'influent', parameters: { flow: 1000 } },
    ];
    const result = aggregateBoQ(nodes, {});
    expect(result.nodeCount).toBe(1);
    expect(result.grandTotal).toBe(0);
  });

  it('attaches nodeId to every emitted line item', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('civil', 100, 18000, 'concrete')], total: 1_800_000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.lineItemsByCategory.civil[0]!.nodeId).toBe('n1');
  });
});
