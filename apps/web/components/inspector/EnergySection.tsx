import type { ProcessResult } from '@repo/sim-engine';
import { Zap } from 'lucide-react';
import { InspectorSection } from './InspectorSection';
import { CalculationRecordCard } from './CalculationRecordCard';

interface Props {
  energy?: ProcessResult['energy'];
}

export function EnergySection({ energy }: Props) {
  if (!energy) return null;
  if (
    energy.installedKW === 0 &&
    energy.dailyKWh === 0 &&
    energy.records.length === 0
  ) {
    return null;
  }

  return (
    <InspectorSection title="Energy">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-foreground">{energy.installedKW.toFixed(1)}</span>
          <span className="text-muted-foreground">kW installed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-foreground">{energy.dailyKWh.toFixed(0)}</span>
          <span className="text-muted-foreground">kWh/d</span>
        </div>
      </div>
      {energy.records.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {energy.records.map((r, i) => (
            <CalculationRecordCard key={i} record={r} />
          ))}
        </div>
      )}
    </InspectorSection>
  );
}
