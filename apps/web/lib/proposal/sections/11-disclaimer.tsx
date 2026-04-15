import { SectionShell } from './section-shell';

interface Props {
  text: string;
  onChange: (text: string) => void;
}

export function DisclaimerSection(_props: Props) {
  return (
    <SectionShell number={11} title="Disclaimer">
      <p className="text-muted-foreground italic">Editable disclaimer — populated in Task 11.</p>
    </SectionShell>
  );
}
