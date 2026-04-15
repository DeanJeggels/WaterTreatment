'use client';

import type { SimulationResults } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
  dischargeStandard: DwaDischargeStandard;
}

export function DesignBasisSection({ dischargeStandard }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);
  const influent = nodes.find((n) => n.data.unitType === 'influent');
  const params: Record<string, number> = influent?.data.parameters ?? {};

  return (
    <SectionShell number={3} title="Design Basis">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Design flows</h3>
          <dl className="space-y-1 text-sm font-mono">
            <Row label="ADWF" value={params.flow} unit="m³/d" />
            <Row label="COD" value={params.COD} unit="mg/L" />
            <Row label="TKN" value={params.TKN} unit="mgN/L" />
            <Row label="TP" value={params.TP} unit="mgP/L" />
            <Row label="TSS" value={params.TSS} unit="mg/L" />
          </dl>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Effluent targets (DWA)</h3>
          <dl className="space-y-1 text-sm font-mono">
            {dischargeStandard.COD !== undefined && (
              <Row label="COD" value={dischargeStandard.COD} unit="mg/L" />
            )}
            {dischargeStandard.NH3N !== undefined && (
              <Row label="NH₃-N" value={dischargeStandard.NH3N} unit="mgN/L" />
            )}
            {dischargeStandard.NO3N !== undefined && (
              <Row label="NO₃-N" value={dischargeStandard.NO3N} unit="mgN/L" />
            )}
            {dischargeStandard.TSS !== undefined && (
              <Row label="TSS" value={dischargeStandard.TSS} unit="mg/L" />
            )}
            {dischargeStandard.TP !== undefined && (
              <Row label="TP" value={dischargeStandard.TP} unit="mgP/L" />
            )}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground italic">{dischargeStandard.source}</p>
        </div>
      </div>
    </SectionShell>
  );
}

function Row({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">
        {value === undefined ? '—' : value.toFixed(value >= 100 ? 0 : 1)}
        <span className="ml-1 text-muted-foreground/80">{unit}</span>
      </dd>
    </div>
  );
}
