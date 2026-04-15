import type { SimulationResults } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function SizingCalculationsSection(_props: Props) {
  return (
    <SectionShell number={5} title="Sizing Calculations">
      <p className="text-muted-foreground italic">Per-unit calculation records — populated in Task 8.</p>
    </SectionShell>
  );
}
