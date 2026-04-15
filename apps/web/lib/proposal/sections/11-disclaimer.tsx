import { SectionShell } from './section-shell';

interface Props {
  text: string;
  onChange: (text: string) => void;
}

export function DisclaimerSection({ text, onChange }: Props) {
  return (
    <SectionShell number={11} title="Disclaimer">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[100px] rounded-md border border-border bg-card/50 p-3 text-sm leading-relaxed text-foreground resize-y print:border-0 print:bg-transparent print:p-0 print:resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </SectionShell>
  );
}
