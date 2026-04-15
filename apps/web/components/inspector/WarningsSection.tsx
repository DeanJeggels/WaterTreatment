import { AlertTriangle } from 'lucide-react';
import { InspectorSection } from './InspectorSection';

interface Props {
  warnings?: string[];
}

export function WarningsSection({ warnings }: Props) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <InspectorSection title={`Warnings (${warnings.length})`} variant="destructive">
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </InspectorSection>
  );
}
