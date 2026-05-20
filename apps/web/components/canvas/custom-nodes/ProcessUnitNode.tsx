'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Droplets, Cylinder, Wind, Moon, FlaskConical, Triangle,
  GitBranch, Merge, Funnel, Waves,
  Filter, Circle, Square, Layers, Fan, Droplet, Beaker, Sun, ArrowUp,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFlowsheetStore, type FlowsheetNodeData } from '@/stores/flowsheet-store';
import type { UnitType, WaterQuality } from '@repo/sim-engine';
import { unitDefinitions } from '@repo/sim-engine';
import { useSimulationStore } from '@/stores/simulation-store';

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

const wqDisplayKeys: { key: keyof WaterQuality; label: string; unit: string }[] = [
  { key: 'flow', label: 'Flow', unit: 'm³/d' },
  { key: 'COD', label: 'COD', unit: 'mg/L' },
  { key: 'BOD5', label: 'BOD5', unit: 'mg/L' },
  { key: 'NH3N', label: 'NH3-N', unit: 'mgN/L' },
  { key: 'NO3N', label: 'NO3-N', unit: 'mgN/L' },
  { key: 'TSS', label: 'TSS', unit: 'mg/L' },
  { key: 'TP', label: 'TP', unit: 'mgP/L' },
];

function ProcessUnitNode({ id, data, selected }: { id: string; data: FlowsheetNodeData; selected?: boolean }) {
  const Icon = iconMap[data.unitType] ?? Droplets;
  const def = unitDefinitions[data.unitType];
  const { results, compliance } = useSimulationStore();

  // Determine handles based on unit definition
  const inputHandles = def.handles.filter(h => h.type === 'input');
  const outputHandles = def.handles.filter(h => h.type === 'output');

  // Get simulation result for this node
  const nodeResult = results?.nodeResults[id];
  const firstOutput = nodeResult
    ? (Object.values(nodeResult.outputs)[0] as WaterQuality | undefined)
    : undefined;

  // Determine border color based on simulation state
  let borderColor = 'border-border hover:border-primary/50'; // not simulated
  if (selected) {
    borderColor = 'border-primary shadow-lg shadow-primary/20';
  } else if (nodeResult && data.unitType === 'effluent' && compliance) {
    const allPass = Object.values(compliance).every(c => c.pass);
    borderColor = allPass
      ? 'border-primary shadow-md shadow-primary/20'
      : 'border-destructive shadow-md shadow-destructive/20';
  } else if (nodeResult) {
    borderColor = 'border-primary/50';
  }

  const nodeContent = (
    <div
      className={`
        group relative flex flex-col items-center gap-1 rounded-lg border-2 bg-card p-3 min-w-[100px]
        transition-colors ${borderColor}
      `}
    >
      {/* Delete button — revealed on hover */}
      <button
        type="button"
        aria-label="Delete unit"
        title="Delete unit"
        onClick={(e) => {
          e.stopPropagation();
          useFlowsheetStore.getState().deleteNode(id);
        }}
        className="nodrag absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* Input handles */}
      {inputHandles.map((h, i) => (
        <Handle
          key={h.id}
          id={h.id}
          type="target"
          position={h.position === 'top' ? Position.Top : Position.Left}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background"
          style={inputHandles.length > 1 ? { top: `${30 + i * 25}%` } : undefined}
        />
      ))}

      {/* Node content */}
      <Icon className="h-8 w-8 text-primary" />
      <span className="text-xs font-medium text-center leading-tight max-w-[90px]">
        {data.label}
      </span>

      {/* Mini WQ badge when simulated */}
      {firstOutput && (
        <div className="flex gap-1 mt-0.5">
          <span className="text-[9px] bg-muted px-1 rounded font-mono">
            {firstOutput.COD.toFixed(0)}
          </span>
          <span className="text-[9px] bg-muted px-1 rounded font-mono">
            {firstOutput.TSS.toFixed(0)}
          </span>
        </div>
      )}

      {/* Output handles */}
      {outputHandles.map((h, i) => {
        const pos = h.position === 'bottom' ? Position.Bottom : Position.Right;
        return (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            position={pos}
            className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            style={
              pos === Position.Right && outputHandles.filter(oh => oh.position === 'right').length > 1
                ? { top: `${30 + i * 25}%` }
                : undefined
            }
          />
        );
      })}
    </div>
  );

  if (!firstOutput) return nodeContent;

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger render={<div />}>{nodeContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium text-xs mb-1">{data.label} — Output</p>
          <div className="space-y-0.5">
            {wqDisplayKeys.map(({ key, label, unit }) => (
              <div key={key} className="flex justify-between gap-4 text-[11px]">
                <span className="text-muted-foreground">{label} ({unit})</span>
                <span className="font-mono">{(firstOutput[key] as number).toFixed(key === 'flow' ? 0 : 2)}</span>
              </div>
            ))}
          </div>
          {nodeResult && Object.keys(nodeResult.metadata).length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              {Object.entries(nodeResult.metadata).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-[11px]">
                  <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                  <span className="font-mono">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                </div>
              ))}
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default memo(ProcessUnitNode);
