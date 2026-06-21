'use client';

import type { PlantEvaluation } from '@repo/sim-engine';
import type { FlowsheetNode } from '@/stores/flowsheet-store';
import { InspectorSection } from './InspectorSection';
import { Badge } from '@/components/ui/badge';

interface Props {
  evaluation: PlantEvaluation | null;
  nodes: FlowsheetNode[];
}

function money(zar: number): string {
  if (!Number.isFinite(zar)) return '—';
  if (zar >= 1e6) return `R ${(zar / 1e6).toFixed(1)}M`;
  if (zar >= 1e3) return `R ${(zar / 1e3).toFixed(0)}k`;
  return `R ${zar.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function MassBalanceSection({ evaluation, nodes }: Props) {
  if (!evaluation) return null;

  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const plantFlow = evaluation.ledger.plant.find((p) => p.component === 'flow');
  const flowClosure = plantFlow ? plantFlow.closurePct : 100;
  const closureOk = flowClosure > 99.5 && flowClosure < 100.5;

  return (
    <InspectorSection
      title="Plant economics & balance"
      description="From the headless engine (evaluatePlant)"
    >
      {/* Headline economics */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">CAPEX</dt>
          <dd className="text-foreground">{money(evaluation.capexZar)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">OPEX/yr</dt>
          <dd className="text-foreground">{money(evaluation.opexZarPerYear)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Footprint</dt>
          <dd className="text-foreground">{Math.round(evaluation.footprintM2)} m²</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Energy</dt>
          <dd className="text-foreground">{Math.round(evaluation.energyKwhPerDay)} kWh/d</dd>
        </div>
      </dl>

      {/* Flow closure headline */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-background/50 px-2.5 py-1.5">
        <span className="text-xs text-muted-foreground">Plant flow closure</span>
        <Badge variant={closureOk ? 'outline' : 'destructive'} className="font-mono text-[10px]">
          {pct(flowClosure)}
        </Badge>
      </div>

      {/* Per-node flow closure + removal */}
      <div className="mt-2 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          <span>Node</span>
          <span className="flex gap-3">
            <span className="w-14 text-right">flow ✓</span>
            <span className="w-16 text-right">COD kg/d</span>
          </span>
        </div>
        {evaluation.ledger.nodes.map((n) => {
          const flow = n.balances.find((b) => b.component === 'flow');
          const cod = n.balances.find((b) => b.component === 'COD');
          const nodeOk = !flow || (flow.closurePct > 99.5 && flow.closurePct < 100.5);
          return (
            <div key={n.nodeId} className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
              <span className="truncate text-foreground">{labelOf(n.nodeId)}</span>
              <span className="flex gap-3 shrink-0">
                <span className={`w-14 text-right ${nodeOk ? 'text-muted-foreground' : 'text-destructive'}`}>
                  {flow ? pct(flow.closurePct) : '—'}
                </span>
                <span className="w-16 text-right text-muted-foreground">
                  {cod ? Math.round(cod.removedLoad) : '—'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        Flow conserves at every node with all handles wired. A clarifier underflow with no RAS/WAS
        line drawn reads &lt;100% (that flow leaves as sludge). COD/N show real removal.
      </p>
    </InspectorSection>
  );
}
