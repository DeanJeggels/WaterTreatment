import type { Dimension } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { formatResult } from './CalculationRecordCard';

interface Props {
  sizing?: Record<string, Dimension>;
}

export function SizingSection({ sizing }: Props) {
  if (!sizing || Object.keys(sizing).length === 0) return null;
  return (
    <InspectorSection title="Sizing">
      <dl className="font-mono text-xs space-y-1">
        {Object.entries(sizing).map(([key, dim]) => (
          <div key={key} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{humanize(key)}</dt>
            <dd className="text-foreground whitespace-nowrap">
              {formatResult(dim.value)}
              <span className="ml-1 text-muted-foreground/80">{dim.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </InspectorSection>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
