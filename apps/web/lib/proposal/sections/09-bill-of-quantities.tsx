import type { AggregatedBoQ } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  boq: AggregatedBoQ | null;
}

export function BillOfQuantitiesSection(_props: Props) {
  return (
    <SectionShell number={9} title="Bill of Quantities">
      <p className="text-muted-foreground italic">Per-category BoQ tables — populated in Task 10.</p>
    </SectionShell>
  );
}
