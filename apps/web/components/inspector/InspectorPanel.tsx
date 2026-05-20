'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { getRecycleEdgeIds } from '@/lib/recycle';
import { unitDefinitions } from '@repo/sim-engine';
import type { ParameterField, WaterQuality } from '@repo/sim-engine';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/layout/empty-state';
import { HelpTooltip } from '@/components/help-tooltip';
import { MousePointer2, Trash2 } from 'lucide-react';

import { WaterQualityTable } from './WaterQualityTable';
import { InspectorSection } from './InspectorSection';
import { WarningsSection } from './WarningsSection';
import { SizingSection } from './SizingSection';
import { EnergySection } from './EnergySection';
import { ConsumablesSection } from './ConsumablesSection';
import { CalculationRecordsSection } from './CalculationRecordsSection';
import { BoqSection } from './BoqSection';
import { DesignSummarySection } from './DesignSummarySection';

export default function InspectorPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    deleteEdge,
  } = useFlowsheetStore();
  const { results } = useSimulationStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setShowAdvanced(false);
  }, [selectedNodeId]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const recycleIds = useMemo(() => getRecycleEdgeIds(nodes, edges), [nodes, edges]);

  if (!selectedNode) {
    // Edge selected (and no node) — show the recycle ratio editor.
    if (selectedEdgeId) {
      const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
      const isRecycle = selectedEdge ? recycleIds.has(selectedEdge.id) : false;
      const ratio =
        (selectedEdge?.data as { recycleRatio?: number } | undefined)?.recycleRatio ?? 4;

      return (
        <div className="w-80 border-l border-border bg-card/30 overflow-y-auto">
          <div className="p-4 space-y-4">
            <DesignSummarySection results={results} nodes={nodes} />

            <Separator />

            {isRecycle ? (
              <InspectorSection title="Recycle line">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="recycleRatio" className="text-xs">
                      Recycle ratio
                      <span className="text-muted-foreground ml-1">(× influent)</span>
                    </Label>
                    <Input
                      id="recycleRatio"
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={ratio}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          updateEdgeData(selectedEdgeId, { recycleRatio: val });
                        }
                      }}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flow returned upstream = ratio × plant influent flow.
                  </p>
                </div>
              </InspectorSection>
            ) : (
              <InspectorSection title="Stream">
                <p className="text-xs text-muted-foreground">
                  This line is a forward stream. Only lines that loop back upstream carry a
                  recycle ratio.
                </p>
              </InspectorSection>
            )}

            <Separator />

            <Button
              variant="destructive"
              size="xs"
              onClick={() => deleteEdge(selectedEdgeId)}
              className="w-full"
            >
              <Trash2 />
              Delete line
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-80 border-l border-border bg-card/30 overflow-y-auto">
        <div className="p-4 space-y-4">
          <DesignSummarySection results={results} nodes={nodes} />
          <EmptyState
            icon={MousePointer2}
            title="No unit selected"
            description="Click a process unit on the canvas to configure its parameters and view its calculation trail."
          />
        </div>
      </div>
    );
  }

  const def = unitDefinitions[selectedNode.data.unitType];
  const nodeResult = results?.nodeResults[selectedNode.id];

  const hasRecords = (nodeResult?.calculationRecords?.length ?? 0) > 0;
  const hasMetadata = nodeResult && Object.keys(nodeResult.metadata ?? {}).length > 0;

  const essentials = def.parameterSchema.filter((p) => !p.advanced);
  const advanceds = def.parameterSchema.filter((p) => p.advanced);

  const renderField = (param: ParameterField) => (
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
        className="h-8 text-sm font-mono"
      />
    </div>
  );

  return (
    <div className="w-80 border-l border-border bg-card/30 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{selectedNode.data.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => deleteNode(selectedNode.id)}
            title="Delete unit"
            aria-label="Delete unit"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>

        <Separator />

        {/* Plant-wide Design Summary — visible regardless of selected node */}
        <DesignSummarySection results={results} nodes={nodes} />

        {/* Warnings first — impossible to miss */}
        <WarningsSection warnings={nodeResult?.warnings} />

        {/* Config / parameters */}
        {def.parameterSchema.length > 0 && (
          <InspectorSection title="Configuration">
            <div className="space-y-3">
              {essentials.length === 0 && advanceds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  This unit has no required configuration. Show advanced settings to see optional parameters.
                </p>
              )}
              {essentials.map(renderField)}
              {advanceds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
                  >
                    {showAdvanced ? 'Hide' : 'Show'} advanced settings ({advanceds.length})
                  </button>
                  {showAdvanced && advanceds.map(renderField)}
                </>
              )}
            </div>
          </InspectorSection>
        )}

        {nodeResult && (
          <>
            <Separator />

            <SizingSection sizing={nodeResult.sizing} />
            <EnergySection energy={nodeResult.energy} />
            <ConsumablesSection consumables={nodeResult.consumables} />
            <CalculationRecordsSection records={nodeResult.calculationRecords} />
            <BoqSection capex={nodeResult.capex} />

            {/* Legacy metadata fallback — only when no calc records */}
            {!hasRecords && hasMetadata && (
              <InspectorSection title="Metadata">
                <dl className="space-y-0.5 font-mono text-xs">
                  {Object.entries(nodeResult.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
                      <dd className="text-foreground">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </InspectorSection>
            )}

            {Object.entries(nodeResult.outputs).length > 0 && (
              <InspectorSection title="Output Streams">
                <div className="space-y-3">
                  {Object.entries(nodeResult.outputs).map(([handleId, wq]) => (
                    <div key={handleId} className="space-y-1">
                      <Badge variant="outline" className="text-[10px]">{handleId}</Badge>
                      <WaterQualityTable wq={wq as WaterQuality} />
                    </div>
                  ))}
                </div>
              </InspectorSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
