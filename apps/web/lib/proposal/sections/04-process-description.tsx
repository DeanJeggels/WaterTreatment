'use client';

import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { unitDefinitions } from '@repo/sim-engine';
import { SectionShell } from './section-shell';
import { FlowsheetFigure } from '../FlowsheetFigure';

export function ProcessDescriptionSection() {
  const nodes = useFlowsheetStore((s) => s.nodes);

  // Unique unit types in the flowsheet, preserving first-occurrence order
  const uniqueTypes = Array.from(new Set(nodes.map((n) => n.data.unitType)));

  return (
    <SectionShell number={4} title="Process Description">
      <FlowsheetFigure />
      <p className="text-sm text-muted-foreground italic">
        Figure 1. Plant process flow diagram. {nodes.length} process units in series.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mt-6 mb-2">
        Unit descriptions
      </h3>
      <dl className="space-y-3">
        {uniqueTypes.map((type) => {
          const def = unitDefinitions[type];
          if (!def) return null;
          return (
            <div key={type} className="text-sm">
              <dt className="font-medium text-foreground">{def.label}</dt>
              <dd className="text-muted-foreground">{def.description}</dd>
            </div>
          );
        })}
      </dl>
    </SectionShell>
  );
}
