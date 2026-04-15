'use client';

import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { CalculationRecordCard } from '@/components/inspector/CalculationRecordCard';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function AerationDesignSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  const aerobicNode = nodes.find((n) => n.data.unitType === 'bioreactor_aerobic');
  const blowerNode = nodes.find((n) => n.data.unitType === 'aeration_blower');

  const aerobicResult = aerobicNode && results ? results.nodeResults[aerobicNode.id] : null;
  const blowerResult = blowerNode && results ? results.nodeResults[blowerNode.id] : null;

  if (!aerobicResult && !blowerResult) {
    return (
      <SectionShell number={6} title="Aeration Design">
        <p className="text-muted-foreground italic">No aeration units in this flowsheet.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={6} title="Aeration Design">
      {aerobicResult?.energy?.records && aerobicResult.energy.records.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Oxygen demand</h3>
          {aerobicResult.energy.records.map((r, i) => (
            <CalculationRecordCard key={i} record={r} />
          ))}
        </div>
      )}
      {blowerResult && (
        <div className="space-y-1.5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mt-4 mb-2">
            Blower sizing (installed: {(blowerResult.energy?.installedKW ?? 0).toFixed(1)} kW)
          </h3>
          {(blowerResult.calculationRecords ?? []).map((r, i) => (
            <CalculationRecordCard key={i} record={r} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
