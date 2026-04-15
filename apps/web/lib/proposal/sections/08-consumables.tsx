'use client';

import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

interface AggregatedConsumable {
  item: string;
  daily: number;
  unit: string;
  citation: string;
  sourceNodeLabels: string[];
}

export function ConsumablesSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={8} title="Consumables">
        <p className="text-muted-foreground italic">Run the simulation to populate consumables.</p>
      </SectionShell>
    );
  }

  // Merge consumables by (item, unit) key
  const agg = new Map<string, AggregatedConsumable>();
  for (const n of nodes) {
    const nr = results.nodeResults[n.id];
    for (const c of nr?.consumables ?? []) {
      const key = `${c.item}::${c.unit}`;
      const existing = agg.get(key);
      if (existing) {
        existing.daily += c.daily;
        existing.sourceNodeLabels.push(n.data.label);
      } else {
        agg.set(key, {
          item: c.item,
          daily: c.daily,
          unit: c.unit,
          citation: c.citation,
          sourceNodeLabels: [n.data.label],
        });
      }
    }
  }

  const rows = Array.from(agg.values());

  if (rows.length === 0) {
    return (
      <SectionShell number={8} title="Consumables">
        <p className="text-muted-foreground italic">No consumables in this flowsheet.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={8} title="Consumables">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Daily</th>
            <th className="pb-2 text-right">Annual</th>
            <th className="pb-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 align-top">
              <td className="py-1.5 text-foreground">{r.item}</td>
              <td className="py-1.5 text-right font-mono text-foreground">
                {r.daily.toFixed(2)} <span className="text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right font-mono text-foreground">
                {(r.daily * 365).toFixed(0)}{' '}
                <span className="text-muted-foreground/80">
                  {r.unit.replace('/d', '/yr').replace('day', 'year')}
                </span>
              </td>
              <td className="py-1.5 text-xs text-muted-foreground italic">{r.citation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}
