import type { ConsumableItem } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { formatResult } from './CalculationRecordCard';

interface Props {
  consumables?: ConsumableItem[];
}

export function ConsumablesSection({ consumables }: Props) {
  if (!consumables || consumables.length === 0) return null;
  return (
    <InspectorSection title="Consumables" description="Daily operating inputs">
      <ul className="space-y-1.5 text-xs">
        {consumables.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2">
            <span className="text-foreground flex-1 min-w-0 truncate">{c.item}</span>
            <span className="font-mono text-foreground whitespace-nowrap">
              {formatResult(c.daily)}
              <span className="ml-1 text-muted-foreground/80">{c.unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </InspectorSection>
  );
}
