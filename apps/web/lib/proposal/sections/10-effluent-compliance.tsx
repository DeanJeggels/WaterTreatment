import type { WaterQuality } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { SectionShell } from './section-shell';

interface Props {
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
}

export function EffluentComplianceSection(_props: Props) {
  return (
    <SectionShell number={10} title="Effluent Compliance">
      <p className="text-muted-foreground italic">Pass/fail vs DWA limits — populated in Task 10.</p>
    </SectionShell>
  );
}
