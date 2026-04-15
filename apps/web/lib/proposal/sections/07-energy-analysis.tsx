'use client';

import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

// Indicative SA industrial tariff — engineer should override per project
const ZAR_PER_KWH = 2.20;

export function EnergyAnalysisSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={7} title="Energy Analysis">
        <p className="text-muted-foreground italic">Run the simulation to populate energy summary.</p>
      </SectionShell>
    );
  }

  const rows = nodes
    .map((n) => {
      const nr = results.nodeResults[n.id];
      const kw = nr?.energy?.installedKW ?? 0;
      const kwhd = nr?.energy?.dailyKWh ?? 0;
      return { id: n.id, label: n.data.label, kw, kwhd };
    })
    .filter((r) => r.kw > 0 || r.kwhd > 0);

  const totalKW = rows.reduce((s, r) => s + r.kw, 0);
  const totalKWhD = rows.reduce((s, r) => s + r.kwhd, 0);
  const annualKWh = totalKWhD * 365;
  const annualCost = annualKWh * ZAR_PER_KWH;

  return (
    <SectionShell number={7} title="Energy Analysis">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Unit</th>
            <th className="pb-2 text-right">Installed kW</th>
            <th className="pb-2 text-right">kWh/day</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-1.5 font-sans text-foreground">{r.label}</td>
              <td className="py-1.5 text-right text-foreground">{r.kw.toFixed(1)}</td>
              <td className="py-1.5 text-right text-foreground">{r.kwhd.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border font-semibold">
          <tr>
            <td className="py-2 text-foreground">Total</td>
            <td className="py-2 text-right font-mono text-foreground">{totalKW.toFixed(1)}</td>
            <td className="py-2 text-right font-mono text-foreground">{totalKWhD.toFixed(0)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Annual energy consumption</span>
          <span className="font-mono text-foreground">
            {annualKWh.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} kWh/year
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-muted-foreground">Annual cost @ R{ZAR_PER_KWH.toFixed(2)}/kWh</span>
          <span className="font-mono text-foreground">
            R{annualCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic mt-1">
        Tariff is an indicative SA industrial rate; adjust for the specific site.
      </p>
    </SectionShell>
  );
}
