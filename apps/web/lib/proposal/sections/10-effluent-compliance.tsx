import type { WaterQuality } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionShell } from './section-shell';

interface Props {
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
}

interface Row {
  label: string;
  value: number | undefined;
  limit: number | undefined;
  unit: string;
  status: 'pass' | 'fail' | 'na';
}

export function EffluentComplianceSection({ effluentStream, dischargeStandard }: Props) {
  if (!effluentStream) {
    return (
      <SectionShell number={10} title="Effluent Compliance">
        <p className="text-muted-foreground italic">Add an Effluent unit and run the simulation.</p>
      </SectionShell>
    );
  }

  const raw: Omit<Row, 'status'>[] = [
    { label: 'COD', value: effluentStream.COD, limit: dischargeStandard.COD, unit: 'mg/L' },
    { label: 'BOD₅', value: effluentStream.BOD5, limit: dischargeStandard.BOD5, unit: 'mg/L' },
    { label: 'NH₃-N', value: effluentStream.NH3N, limit: dischargeStandard.NH3N, unit: 'mgN/L' },
    { label: 'NO₃-N', value: effluentStream.NO3N, limit: dischargeStandard.NO3N, unit: 'mgN/L' },
    { label: 'TSS', value: effluentStream.TSS, limit: dischargeStandard.TSS, unit: 'mg/L' },
    { label: 'TP', value: effluentStream.TP, limit: dischargeStandard.TP, unit: 'mgP/L' },
  ];

  const evaluated: Row[] = raw.map((r) => {
    if (r.value === undefined || r.limit === undefined) return { ...r, status: 'na' };
    return { ...r, status: r.value <= r.limit ? 'pass' : 'fail' };
  });

  const failCount = evaluated.filter((r) => r.status === 'fail').length;

  return (
    <SectionShell number={10} title="Effluent Compliance">
      <div
        className={cn(
          'mb-3 rounded-md border p-3 text-sm',
          failCount === 0
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-destructive/50 bg-destructive/10 text-destructive',
        )}
      >
        {failCount === 0
          ? 'Effluent meets all applicable DWA limits.'
          : `${failCount} parameter${failCount === 1 ? '' : 's'} exceed the DWA limit.`}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Parameter</th>
            <th className="pb-2 text-right">Effluent</th>
            <th className="pb-2 text-right">DWA limit</th>
            <th className="pb-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {evaluated.map((r) => (
            <tr key={r.label} className="border-b border-border/50">
              <td className="py-1.5 font-sans text-foreground">{r.label}</td>
              <td className="py-1.5 text-right text-foreground">
                {r.value !== undefined ? r.value.toFixed(2) : '—'}
                <span className="ml-1 text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right text-muted-foreground">
                {r.limit !== undefined ? r.limit.toFixed(2) : '—'}
                <span className="ml-1 text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right">
                {r.status === 'pass' && <CheckCircle2 className="inline h-4 w-4 text-primary" />}
                {r.status === 'fail' && <XCircle className="inline h-4 w-4 text-destructive" />}
                {r.status === 'na' && <MinusCircle className="inline h-4 w-4 text-muted-foreground/60" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground italic mt-2">{dischargeStandard.source}</p>
    </SectionShell>
  );
}
