'use client';

import { useState } from 'react';
import { useSimulationStore } from '@/stores/simulation-store';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WaterQuality, DischargeStandards } from '@repo/sim-engine';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';

const CHART_COLORS = {
  COD: 'hsl(220, 70%, 50%)',
  BOD5: 'hsl(160, 60%, 45%)',
  NH3N: 'hsl(30, 80%, 55%)',
  TSS: 'hsl(0, 60%, 50%)',
  TP: 'hsl(280, 60%, 55%)',
};

export default function ResultsPanel() {
  const { results, status, compliance } = useSimulationStore();
  const { nodes } = useFlowsheetStore();
  const [expanded, setExpanded] = useState(true);

  if (!results || status !== 'completed') {
    return (
      <div className="border-t border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Run a simulation to see results here.
        </p>
      </div>
    );
  }

  // Build process train profile data
  const profileData: { name: string; COD: number; BOD5: number; NH3N: number; TSS: number; TP: number }[] = [];
  for (const node of nodes) {
    const nodeResult = results.nodeResults[node.id];
    if (!nodeResult) continue;
    const firstOutput = Object.values(nodeResult.outputs)[0] as WaterQuality | undefined;
    if (!firstOutput) continue;
    profileData.push({
      name: node.data.label,
      COD: Math.round(firstOutput.COD * 10) / 10,
      BOD5: Math.round(firstOutput.BOD5 * 10) / 10,
      NH3N: Math.round(firstOutput.NH3N * 100) / 100,
      TSS: Math.round(firstOutput.TSS * 10) / 10,
      TP: Math.round(firstOutput.TP * 100) / 100,
    });
  }

  return (
    <div className={`border-t border-border bg-card transition-all ${expanded ? 'h-80' : 'h-10'}`}>
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 h-10 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>Simulation Results</span>
        <div className="flex items-center gap-3">
          <span>
            {results.converged ? 'Converged' : 'Not converged'} in {results.iterations} iteration{results.iterations !== 1 ? 's' : ''}
            {' '} | Mass balance error: {(results.massBalanceError * 100).toFixed(1)}%
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 h-[calc(100%-2.5rem)] overflow-hidden">
          <Tabs defaultValue="chart" className="h-full">
            <TabsList className="h-7">
              <TabsTrigger value="chart" className="text-xs h-6 px-3">Chart</TabsTrigger>
              <TabsTrigger value="table" className="text-xs h-6 px-3">Table</TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs h-6 px-3">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="h-[calc(100%-2rem)] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profileData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                      zIndex: 50,
                    }}
                    wrapperStyle={{ zIndex: 50 }}
                    offset={20}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    isAnimationActive={false}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="COD" fill={CHART_COLORS.COD} name="COD (mg/L)" />
                  <Bar dataKey="BOD5" fill={CHART_COLORS.BOD5} name="BOD5 (mg/L)" />
                  <Bar dataKey="NH3N" fill={CHART_COLORS.NH3N} name="NH3-N (mgN/L)" />
                  <Bar dataKey="TSS" fill={CHART_COLORS.TSS} name="TSS (mg/L)" />
                  <Bar dataKey="TP" fill={CHART_COLORS.TP} name="TP (mgP/L)" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="table" className="h-[calc(100%-2rem)] mt-2 overflow-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 pr-4 text-muted-foreground sticky left-0 bg-card">Unit</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">COD</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">BOD5</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">NH3-N</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">NO3-N</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">TSS</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">TP</th>
                    <th className="text-right py-1 px-2 text-muted-foreground">Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => {
                    const nodeResult = results.nodeResults[node.id];
                    if (!nodeResult) return null;
                    const wq = Object.values(nodeResult.outputs)[0] as WaterQuality | undefined;
                    if (!wq) return null;
                    return (
                      <tr key={node.id} className="border-b border-border/50">
                        <td className="py-1 pr-4 font-medium sticky left-0 bg-card">{node.data.label}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.COD.toFixed(1)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.BOD5.toFixed(1)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.NH3N.toFixed(2)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.NO3N.toFixed(2)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.TSS.toFixed(1)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.TP.toFixed(2)}</td>
                        <td className="text-right py-1 px-2 font-mono">{wq.flow.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="compliance" className="h-[calc(100%-2rem)] mt-2 overflow-auto">
              <ComplianceTab compliance={compliance} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// ── Configurable Discharge Standards + Compliance Results ────
const standardFields: { key: keyof DischargeStandards; label: string; unit: string }[] = [
  { key: 'COD', label: 'COD', unit: 'mg/L' },
  { key: 'BOD5', label: 'BOD5', unit: 'mg/L' },
  { key: 'NH3N', label: 'NH3-N', unit: 'mgN/L' },
  { key: 'NO3N', label: 'NO3-N', unit: 'mgN/L' },
  { key: 'TSS', label: 'TSS', unit: 'mg/L' },
  { key: 'TP', label: 'TP', unit: 'mgP/L' },
  { key: 'pH_min', label: 'pH min', unit: '' },
  { key: 'pH_max', label: 'pH max', unit: '' },
];

function ComplianceTab({
  compliance,
}: {
  compliance: Record<string, { value: number; limit: number; pass: boolean }> | null;
}) {
  const { dischargeStandards, setDischargeStandards, runSimulation } = useSimulationStore();

  function updateStandard(key: keyof DischargeStandards, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setDischargeStandards({ ...dischargeStandards, [key]: num });
  }

  return (
    <div className="flex gap-8">
      {/* Discharge Standards (editable) */}
      <div className="w-64 shrink-0">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
          Discharge Standards
        </h4>
        <div className="space-y-1.5">
          {standardFields.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="text-xs w-16 shrink-0">{label}</Label>
              <Input
                type="number"
                className="h-6 text-xs font-mono px-1.5 w-20"
                value={dischargeStandards[key] ?? ''}
                onChange={(e) => updateStandard(key, e.target.value)}
                step={key === 'pH_min' || key === 'pH_max' ? 0.1 : 1}
              />
              {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
            </div>
          ))}
        </div>
        <button
          onClick={runSimulation}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Re-run with updated standards
        </button>
      </div>

      <Separator orientation="vertical" />

      {/* Compliance Results */}
      <div className="flex-1">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
          Compliance Check
        </h4>
        {compliance ? (
          <div className="space-y-2">
            {Object.entries(compliance).map(([param, result]) => (
              <div key={param} className="flex items-center justify-between text-sm">
                <span className="font-medium">{param}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">{result.value.toFixed(2)}</span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="font-mono text-xs text-muted-foreground">{result.limit}</span>
                  <Badge variant={result.pass ? 'default' : 'destructive'} className="text-xs">
                    {result.pass ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Run a simulation with an effluent node to see compliance results.
          </p>
        )}
      </div>
    </div>
  );
}
