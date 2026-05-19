'use client';

import type { SimulationResults, WaterQuality } from '@repo/sim-engine';
import type { FlowsheetNode } from '@/stores/flowsheet-store';
import { InspectorSection } from './InspectorSection';

interface Props {
  results: SimulationResults | null;
  nodes: FlowsheetNode[];
}

interface SummaryRow {
  label: string;
  value: string;
  unit?: string;
}

function formatNumber(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100000) return n.toExponential(2);
  return n.toFixed(dp);
}

export function DesignSummarySection({ results, nodes }: Props) {
  if (!results) return null;

  const labelOf = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node?.data.label ?? nodeId;
  };

  const rows: SummaryRow[] = [];

  for (const [nodeId, r] of Object.entries(results.nodeResults)) {
    if (!r.sizing) continue;

    // Reactor volume + HRT (aerobic / anoxic / anaerobic / EQ tank — anything with both)
    if (r.sizing.volume) {
      rows.push({
        label: `${labelOf(nodeId)} volume`,
        value: formatNumber(r.sizing.volume.value, 0),
        unit: r.sizing.volume.unit,
      });
    }
    if (r.sizing.HRT) {
      rows.push({
        label: `${labelOf(nodeId)} HRT`,
        value: formatNumber(r.sizing.HRT.value, 1),
        unit: r.sizing.HRT.unit,
      });
    }

    // MBR-specific sizing
    if (r.sizing.membraneArea) {
      rows.push({
        label: `${labelOf(nodeId)} membrane area`,
        value: formatNumber(r.sizing.membraneArea.value, 0),
        unit: r.sizing.membraneArea.unit ?? 'm²',
      });
    }
    if (r.sizing.moduleCount) {
      rows.push({
        label: `${labelOf(nodeId)} module count`,
        value: formatNumber(r.sizing.moduleCount.value, 0),
        unit: r.sizing.moduleCount.unit ?? 'ea',
      });
    }

    // Blower-specific
    if (r.sizing.airFlow && r.energy && r.energy.installedKW > 0) {
      rows.push({
        label: `${labelOf(nodeId)} power`,
        value: formatNumber(r.energy.installedKW, 1),
        unit: 'kW',
      });
      rows.push({
        label: `${labelOf(nodeId)} air flow`,
        value: formatNumber(r.sizing.airFlow.value, 0),
        unit: r.sizing.airFlow.unit ?? 'Am³/hr',
      });
    }
  }

  // Final effluent water quality — Andrew's explicit ask.
  // The effluent unit's process() returns outputs: { out: mixed } where `mixed`
  // is the mixStreams() of its inlets. So nodeResults[effluentId].outputs.out
  // carries the final discharge WaterQuality with no engine changes needed.
  const effluentNodes = nodes.filter((n) => n.data.unitType === 'effluent');
  const effluentRows: SummaryRow[] = [];
  for (const en of effluentNodes) {
    const eRes = results.nodeResults[en.id];
    if (!eRes) continue;
    const wq = eRes.outputs?.out as WaterQuality | undefined;
    if (!wq || !Number.isFinite(wq.flow) || wq.flow <= 0) continue;
    const label = labelOf(en.id);
    effluentRows.push({ label: `${label} flow`, value: formatNumber(wq.flow, 0), unit: 'm³/d' });
    effluentRows.push({ label: `${label} COD`, value: formatNumber(wq.COD, 1), unit: 'mg/L' });
    effluentRows.push({ label: `${label} BOD₅`, value: formatNumber(wq.BOD5, 1), unit: 'mg/L' });
    effluentRows.push({ label: `${label} TSS`, value: formatNumber(wq.TSS, 1), unit: 'mg/L' });
    effluentRows.push({ label: `${label} NH₃-N`, value: formatNumber(wq.NH3N, 2), unit: 'mgN/L' });
    effluentRows.push({ label: `${label} NO₃-N`, value: formatNumber(wq.NO3N, 2), unit: 'mgN/L' });
    effluentRows.push({ label: `${label} TP`, value: formatNumber(wq.TP, 2), unit: 'mgP/L' });
    effluentRows.push({ label: `${label} pH`, value: formatNumber(wq.pH, 1) });
  }

  if (rows.length === 0 && effluentRows.length === 0) return null;

  return (
    <InspectorSection title="Design Summary">
      {rows.length > 0 && (
        <dl className="space-y-1 text-xs">
          {rows.map((row, i) => (
            <div key={`${row.label}-${i}`} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-mono text-foreground">
                {row.value}
                {row.unit && <span className="ml-1 text-muted-foreground">{row.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {effluentRows.length > 0 && (
        <div className={rows.length > 0 ? 'mt-3' : ''}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Final effluent
          </p>
          <dl className="space-y-1 text-xs">
            {effluentRows.map((row, i) => (
              <div key={`eff-${row.label}-${i}`} className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-mono text-foreground">
                  {row.value}
                  {row.unit && <span className="ml-1 text-muted-foreground">{row.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </InspectorSection>
  );
}
