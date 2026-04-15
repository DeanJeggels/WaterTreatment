import type { SimulationResults } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function ConsumablesSection(_props: Props) {
  return (
    <SectionShell number={8} title="Consumables">
      <p className="text-muted-foreground italic">Aggregated daily/annual consumables — populated in Task 9.</p>
    </SectionShell>
  );
}
