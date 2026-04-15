import type { SimulationResults, AggregatedBoQ } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  narrative: string;
  onChange: (narrative: string) => void;
  boq: AggregatedBoQ | null;
  results: SimulationResults | null;
}

export function ExecutiveSummarySection(_props: Props) {
  return (
    <SectionShell number={2} title="Executive Summary">
      <p className="text-muted-foreground italic">Headline stats + narrative — populated in Task 6.</p>
    </SectionShell>
  );
}
