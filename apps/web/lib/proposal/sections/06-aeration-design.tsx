import type { SimulationResults } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function AerationDesignSection(_props: Props) {
  return (
    <SectionShell number={6} title="Aeration Design">
      <p className="text-muted-foreground italic">O₂ demand + blower sizing — populated in Task 8.</p>
    </SectionShell>
  );
}
