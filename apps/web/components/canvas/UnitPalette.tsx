'use client';

import {
  Droplets, Cylinder, Wind, Moon, FlaskConical, Triangle,
  GitBranch, Merge, Funnel, Waves,
  Filter, Circle, Square, Layers, Fan, Droplet, Beaker, Sun, ArrowUp,
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
  screen: Filter,
  grit_removal: Circle,
  equalisation_tank: Square,
  mbr: Layers,
  aeration_blower: Fan,
  dewatering: Droplet,
  chemical_dosing: Beaker,
  uv_disinfection: Sun,
  inlet_pumping: ArrowUp,
};

type Category =
  | 'flow'
  | 'preliminary'
  | 'primary'
  | 'biological'
  | 'tertiary'
  | 'sludge'
  | 'utility';

const CATEGORY_ORDER: Category[] = [
  'flow',
  'preliminary',
  'primary',
  'biological',
  'tertiary',
  'sludge',
  'utility',
];

const CATEGORY_LABELS: Record<Category, string> = {
  flow: 'Flow I/O',
  preliminary: 'Preliminary',
  primary: 'Primary',
  biological: 'Biological',
  tertiary: 'Tertiary',
  sludge: 'Sludge',
  utility: 'Utility',
};

const UNIT_CATEGORY: Record<UnitType, Category> = {
  influent: 'flow',
  effluent: 'flow',
  splitter: 'flow',
  mixer: 'flow',
  inlet_pumping: 'preliminary',
  screen: 'preliminary',
  grit_removal: 'preliminary',
  equalisation_tank: 'preliminary',
  primary_clarifier: 'primary',
  bioreactor_anaerobic: 'biological',
  bioreactor_anoxic: 'biological',
  bioreactor_aerobic: 'biological',
  mbr: 'biological',
  secondary_clarifier: 'biological',
  uv_disinfection: 'tertiary',
  chemical_dosing: 'tertiary',
  thickener: 'sludge',
  dewatering: 'sludge',
  aeration_blower: 'utility',
};

// Units kept in the engine for backward compatibility but no longer offered in the palette.
// aeration_blower: process-air sizing now folds into the aerobic reactor (MBR keeps its own scour blower).
// inlet_pumping: dropped per design review.
const PALETTE_HIDDEN: Set<UnitType> = new Set<UnitType>(['aeration_blower', 'inlet_pumping']);

function groupUnits(): Record<Category, UnitType[]> {
  const groups: Record<Category, UnitType[]> = {
    flow: [], preliminary: [], primary: [], biological: [],
    tertiary: [], sludge: [], utility: [],
  };
  for (const type of Object.keys(unitDefinitions) as UnitType[]) {
    if (PALETTE_HIDDEN.has(type)) continue;
    groups[UNIT_CATEGORY[type]].push(type);
  }
  return groups;
}

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
    event.dataTransfer.setData('application/aquasim-unit-type', unitType);
    event.dataTransfer.effectAllowed = 'move';
  }

  const groups = groupUnits();

  return (
    <aside className="w-56 border-r border-border bg-card/40 overflow-y-auto">
      <div className="px-3 pt-4 pb-2 flex items-center gap-1.5">
        <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          Process Units
        </h2>
        <HelpTooltip text="Drag units onto the canvas to build your flowsheet. Connect them by dragging from output handles to input handles." />
      </div>
      {unitLimit < Infinity && (
        <p className={`px-3 pb-2 text-[10px] ${disabled ? 'text-destructive' : 'text-muted-foreground'}`}>
          {unitCount}/{unitLimit} units{disabled && ' — limit reached'}
        </p>
      )}

      {CATEGORY_ORDER.map((category) => {
        const types = groups[category];
        if (types.length === 0) return null;
        return (
          <section
            key={category}
            className="px-2 py-3 border-t border-border/60 first-of-type:border-t-0"
          >
            <h3 className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="space-y-0.5">
              {types.map((type) => {
                const def = unitDefinitions[type];
                const Icon = iconMap[type];
                return (
                  <li key={type}>
                    <div
                      draggable={!disabled}
                      onDragStart={(e) => onDragStart(e, type)}
                      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        disabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-grab hover:bg-accent hover:text-accent-foreground active:cursor-grabbing'
                      }`}
                      title={disabled ? 'Unit limit reached — upgrade your plan' : def.description}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      <span className="truncate">{def.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
