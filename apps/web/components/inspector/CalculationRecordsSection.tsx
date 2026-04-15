import type { CalculationRecord } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { CalculationRecordCard } from './CalculationRecordCard';

interface Props {
  records?: CalculationRecord[];
}

export function CalculationRecordsSection({ records }: Props) {
  if (!records || records.length === 0) return null;
  return (
    <InspectorSection
      title={`Calculations (${records.length})`}
      description="Every derived number, with equation, inputs, and citation"
    >
      <div className="space-y-1.5">
        {records.map((r, i) => (
          <CalculationRecordCard key={i} record={r} />
        ))}
      </div>
    </InspectorSection>
  );
}
