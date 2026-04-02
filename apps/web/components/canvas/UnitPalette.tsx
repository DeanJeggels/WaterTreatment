'use client';

import {
  Droplets, Cylinder, Wind, Moon, FlaskConical, Triangle,
  GitBranch, Merge, Funnel, Waves,
} from 'lucide-react';
import type { UnitType } from '@repo/sim-engine';
import { unitDefinitions } from '@repo/sim-engine';
import { HelpTooltip } from '@/components/help-tooltip';

const iconMap: Record<UnitType, React.ComponentType<{ className?: string }>> = {
  influent: Droplets,
  primary_clarifier: Cylinder,
  bioreactor_aerobic: Wind,
  bioreactor_anoxic: Moon,
  bioreactor_anaerobic: FlaskConical,
  secondary_clarifier: Triangle,
  splitter: GitBranch,
  mixer: Merge,
  thickener: Funnel,
  effluent: Waves,
};

const unitTypes: UnitType[] = [
  'influent',
  'primary_clarifier',
  'bioreactor_aerobic',
  'bioreactor_anoxic',
  'bioreactor_anaerobic',
  'secondary_clarifier',
  'splitter',
  'mixer',
  'thickener',
  'effluent',
];

export default function UnitPalette({
  disabled = false,
  unitCount = 0,
  unitLimit = Infinity,
}: {
  disabled?: boolean;
  unitCount?: number;
  unitLimit?: number;
}) {
  function onDragStart(event: React.DragEvent, unitType: UnitType) {
    if (disabled) { event.preventDefault(); return; }
    event.dataTransfer.setData('application/biowin-unit-type', unitType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="w-48 border-r border-border bg-card p-3 overflow-y-auto">
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Process Units
        </h3>
        <HelpTooltip text="Drag units onto the canvas to build your flowsheet. Connect them by dragging from output handles to input handles." />
      </div>
      {unitLimit < Infinity && (
        <p className={`text-[10px] mb-2 ${disabled ? 'text-destructive' : 'text-muted-foreground'}`}>
          {unitCount}/{unitLimit} units {disabled && '(limit reached)'}
        </p>
      )}
      <div className="space-y-1">
        {unitTypes.map((type) => {
          const def = unitDefinitions[type];
          const Icon = iconMap[type];
          return (
            <div
              key={type}
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, type)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:bg-accent'}`}
              title={disabled ? 'Unit limit reached — upgrade your plan' : def.description}
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm truncate">{def.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
