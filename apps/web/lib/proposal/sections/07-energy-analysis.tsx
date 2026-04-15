import type { SimulationResults } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function EnergyAnalysisSection(_props: Props) {
  return (
    <SectionShell number={7} title="Energy Analysis">
      <p className="text-muted-foreground italic">Energy summary + annual cost — populated in Task 9.</p>
    </SectionShell>
  );
}
