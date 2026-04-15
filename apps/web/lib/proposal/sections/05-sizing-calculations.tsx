'use client';

import type { SimulationResults } from '@repo/sim-engine';
import { unitDefinitions } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { CalculationRecordCard } from '@/components/inspector/CalculationRecordCard';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function SizingCalculationsSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={5} title="Sizing Calculations">
        <p className="text-muted-foreground italic">Run the simulation to populate sizing calculations.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={5} title="Sizing Calculations">
      <div className="space-y-6 print:space-y-4">
        {nodes.map((node) => {
          const nr = results.nodeResults[node.id];
          if (!nr || !nr.calculationRecords || nr.calculationRecords.length === 0) return null;
          const def = unitDefinitions[node.data.unitType];
          return (
            <div key={node.id} className="print:break-inside-avoid">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {node.data.label}
                {def && <span className="ml-2 font-normal text-muted-foreground">({def.label})</span>}
              </h3>
              <div className="space-y-1.5">
                {nr.calculationRecords.map((r, i) => (
                  <CalculationRecordCard key={i} record={r} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
