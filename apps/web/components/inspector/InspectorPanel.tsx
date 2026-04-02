'use client';

import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { unitDefinitions } from '@repo/sim-engine';
import type { WaterQuality } from '@repo/sim-engine';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/help-tooltip';

export default function InspectorPanel() {
  const { nodes, selectedNodeId, updateNodeData } = useFlowsheetStore();
  const { results } = useSimulationStore();

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  if (!selectedNode) {
    return (
      <div className="w-72 border-l border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Select a process unit to configure its parameters.
        </p>
      </div>
    );
  }

  const def = unitDefinitions[selectedNode.data.unitType];
  const nodeResult = results?.nodeResults[selectedNode.id];

  return (
    <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-lg">{selectedNode.data.label}</h3>
          <p className="text-xs text-muted-foreground">{def.description}</p>
        </div>

        <Separator />

        {/* Parameters */}
        {def.parameterSchema.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-medium">Parameters</h4>
              <HelpTooltip text="Adjust these values to configure the process unit. Changes are reflected in simulation results when you re-run." />
            </div>
            {def.parameterSchema.map((param) => (
              <div key={param.key} className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor={param.key} className="text-xs">
                    {param.label}
                    {param.unit ? (
                      <span className="text-muted-foreground ml-1">({param.unit})</span>
                    ) : null}
                  </Label>
                  {param.description && <HelpTooltip text={param.description} />}
                </div>
                <Input
                  id={param.key}
                  type="number"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={selectedNode.data.parameters[param.key] ?? param.defaultValue}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      updateNodeData(selectedNode.id, {
                        parameters: {
                          ...selectedNode.data.parameters,
                          [param.key]: val,
                        },
                      });
                    }
                  }}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Simulation Results */}
        {nodeResult && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Simulation Results</h4>

              {/* Metadata (HRT, MLSS, etc.) */}
              {Object.entries(nodeResult.metadata).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(nodeResult.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Output Water Quality */}
              {Object.entries(nodeResult.outputs).map(([handleId, wq]) => (
                <div key={handleId} className="space-y-1">
                  <Badge variant="outline" className="text-xs">{handleId}</Badge>
                  <WaterQualityTable wq={wq as WaterQuality} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WaterQualityTable({ wq }: { wq: WaterQuality }) {
  const params: { key: keyof WaterQuality; label: string; unit: string }[] = [
    { key: 'flow', label: 'Flow', unit: 'm³/d' },
    { key: 'COD', label: 'COD', unit: 'mg/L' },
    { key: 'sCOD', label: 'sCOD', unit: 'mg/L' },
    { key: 'BOD5', label: 'BOD₅', unit: 'mg/L' },
    { key: 'TKN', label: 'TKN', unit: 'mgN/L' },
    { key: 'NH3N', label: 'NH₃-N', unit: 'mgN/L' },
    { key: 'NO3N', label: 'NO₃-N', unit: 'mgN/L' },
    { key: 'TP', label: 'TP', unit: 'mgP/L' },
    { key: 'TSS', label: 'TSS', unit: 'mg/L' },
    { key: 'VSS', label: 'VSS', unit: 'mg/L' },
    { key: 'pH', label: 'pH', unit: '' },
    { key: 'alkalinity', label: 'Alk', unit: 'mmol/L' },
    { key: 'DO', label: 'DO', unit: 'mg/L' },
  ];

  return (
    <div className="space-y-0.5">
      {params.map(({ key, label, unit }) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {label} {unit && <span className="text-muted-foreground/60">({unit})</span>}
          </span>
          <span className="font-mono">
            {typeof wq[key] === 'number' ? (wq[key] as number).toFixed(2) : wq[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
