import type { SimulationResults, AggregatedBoQ } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  narrative: string;
  onChange: (narrative: string) => void;
  boq: AggregatedBoQ | null;
  results: SimulationResults | null;
}

function fmtZAR(n: number): string {
  return n.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

export function ExecutiveSummarySection({ narrative, onChange, boq, results }: Props) {
  const unitCount = results ? Object.keys(results.nodeResults).length : 0;
  const installedKW = results
    ? Object.values(results.nodeResults).reduce(
        (sum, r) => sum + (r.energy?.installedKW ?? 0),
        0,
      )
    : 0;
  const grandTotal = boq?.grandTotal ?? 0;
  const civilSubtotal = boq?.subtotalsByCategory.civil ?? 0;
  const mechSubtotal = boq?.subtotalsByCategory.mechanical ?? 0;

  return (
    <SectionShell number={2} title="Executive Summary">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border border-border rounded-md p-4 bg-muted/20 font-mono text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Process units</dt>
          <dd className="text-foreground">{unitCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Installed power</dt>
          <dd className="text-foreground">{installedKW.toFixed(1)} kW</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Civil works</dt>
          <dd className="text-foreground">R{fmtZAR(civilSubtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mech & elec</dt>
          <dd className="text-foreground">R{fmtZAR(mechSubtotal)}</dd>
        </div>
        <div className="flex justify-between col-span-2 border-t border-border pt-2 mt-1">
          <dt className="text-foreground font-semibold">Total CapEx</dt>
          <dd className="text-foreground font-semibold">R{fmtZAR(grandTotal)}</dd>
        </div>
      </dl>

      <div>
        <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1 print:hidden">
          Narrative
        </label>
        <textarea
          value={narrative}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Provide a brief project overview, key design drivers, and expected outcomes…"
          className="w-full min-h-[120px] rounded-md border border-border bg-card/50 p-3 text-sm leading-relaxed text-foreground resize-y print:border-0 print:bg-transparent print:p-0 print:resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </SectionShell>
  );
}
