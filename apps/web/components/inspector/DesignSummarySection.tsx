'use client';

import type { SimulationResults } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';

interface Props {
  results: SimulationResults | null;
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

export function DesignSummarySection({ results }: Props) {
  if (!results) return null;

  const rows: SummaryRow[] = [];

  for (const [nodeId, r] of Object.entries(results.nodeResults)) {
    if (!r.sizing) continue;

    // Reactor volume + HRT (aerobic / anoxic / anaerobic / EQ tank — anything with both)
    if (r.sizing.volume) {
      rows.push({
        label: `${nodeId} volume`,
        value: formatNumber(r.sizing.volume.value, 0),
        unit: r.sizing.volume.unit,
      });
    }
    if (r.sizing.HRT) {
      rows.push({
        label: `${nodeId} HRT`,
        value: formatNumber(r.sizing.HRT.value, 1),
        unit: r.sizing.HRT.unit,
      });
    }

    // MBR-specific sizing
    if (r.sizing.membraneArea) {
      rows.push({
        label: `${nodeId} membrane area`,
        value: formatNumber(r.sizing.membraneArea.value, 0),
        unit: r.sizing.membraneArea.unit ?? 'm²',
      });
    }
    if (r.sizing.moduleCount) {
      rows.push({
        label: `${nodeId} module count`,
        value: formatNumber(r.sizing.moduleCount.value, 0),
        unit: r.sizing.moduleCount.unit ?? 'ea',
      });
    }

    // Blower-specific
    if (r.sizing.airFlow && r.energy && r.energy.installedKW > 0) {
      rows.push({
        label: `${nodeId} power`,
        value: formatNumber(r.energy.installedKW, 1),
        unit: 'kW',
      });
      rows.push({
        label: `${nodeId} air flow`,
        value: formatNumber(r.sizing.airFlow.value, 0),
        unit: r.sizing.airFlow.unit ?? 'Am³/hr',
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <InspectorSection title="Design Summary">
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
    </InspectorSection>
  );
}
