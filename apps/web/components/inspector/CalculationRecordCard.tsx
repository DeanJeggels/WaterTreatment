'use client';

import type { CalculationRecord } from '@repo/sim-engine';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  record: CalculationRecord;
  className?: string;
}

export function CalculationRecordCard({ record, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card/50 p-3 text-xs',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-foreground">{record.symbol}</span>
          <span className="ml-1.5 text-muted-foreground">{record.label}</span>
        </div>
        <div className="font-mono text-foreground whitespace-nowrap">
          {formatResult(record.result.value)}
          <span className="ml-1 text-muted-foreground/80">{record.result.unit}</span>
        </div>
      </div>

      <div className="font-mono text-foreground/90 bg-muted/40 rounded px-2 py-1 my-1.5 break-words">
        {record.equation}
      </div>

      {Object.entries(record.inputs).length > 0 && (
        <dl className="mt-2 space-y-0.5">
          {Object.entries(record.inputs).map(([name, inp]) => (
            <div key={name} className="flex items-baseline gap-2 text-[11px]">
              <dt className="font-mono text-muted-foreground shrink-0 w-10 text-right">{name}</dt>
              <dd className="font-mono text-foreground min-w-0">
                = {formatResult(inp.value)}
                {inp.unit && <span className="text-muted-foreground/80 ml-0.5">{inp.unit}</span>}
                {inp.source && (
                  <span className="text-muted-foreground/60 ml-1.5 italic">({inp.source})</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <BookOpen className="h-3 w-3 shrink-0 mt-0.5" />
        <span className="italic">{record.citation}</span>
      </div>
    </div>
  );
}

/** Format a numeric result — precision based on magnitude. */
export function formatResult(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  if (abs >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}
