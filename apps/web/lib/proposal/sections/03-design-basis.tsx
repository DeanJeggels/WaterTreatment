import type { SimulationResults } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
  dischargeStandard: DwaDischargeStandard;
}

export function DesignBasisSection(_props: Props) {
  return (
    <SectionShell number={3} title="Design Basis">
      <p className="text-muted-foreground italic">Design flows + DWA targets — populated in Task 7.</p>
    </SectionShell>
  );
}
