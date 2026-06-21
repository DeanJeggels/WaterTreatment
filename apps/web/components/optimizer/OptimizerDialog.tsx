'use client';

import { useState, useMemo } from 'react';
import { optimizePlant, delegateMleDesign } from '@repo/sim-engine';
import type { OptimizeResult, OptimizerSpec, ParetoPoint } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

function money(zar: number): string {
  if (zar >= 1e6) return `R ${(zar / 1e6).toFixed(1)}M`;
  if (zar >= 1e3) return `R ${(zar / 1e3).toFixed(0)}k`;
  return `R ${zar.toFixed(0)}`;
}
const trainLabel = (p: ParetoPoint) => `${p.vars.nitrogenRemoval ? 'MLE' : 'AS'}${p.vars.mbr ? '+MBR' : '+SC'}`;

export default function OptimizerDialog() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const run = () => {
    const { nodes } = useFlowsheetStore.getState();
    const influent = nodes.find((n) => n.data.unitType === 'influent');
    const params = (influent?.data.parameters ?? {}) as Record<string, number>;
    const flowM3d = Number(params.flow ?? 0);
    const codMgL = Number(params.COD ?? 0);
    if (!influent || flowM3d <= 0 || codMgL <= 0) {
      toast.error('Add an influent with a flow and COD to optimise.');
      return;
    }
    const spec: OptimizerSpec = {
      flowM3d,
      codMgL,
      tminC: Number(params.temperature ?? 15),
      elevationM: 1700,
      standards: useSimulationStore.getState().dischargeStandards,
    };

    setRunning(true);
    setResult(null);
    setSelected(null);
    setTimeout(() => {
      try {
        const res = optimizePlant(spec, { populationSize: 64, generations: 50, seed: 42 });
        setResult(res);
        setSelected(res.paretoFront.length > 0 ? 0 : null);
        if (res.paretoFront.length === 0) toast.warning('No feasible design met the target effluent. Relax the standards.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Optimisation failed');
      } finally {
        setRunning(false);
      }
    }, 30);
  };

  const point = selected != null && result ? result.paretoFront[selected] : null;
  // Full validated design for the selected point (sizing + flows + effluent).
  const design = useMemo(
    () => (point ? delegateMleDesign(point.graph.nodes, point.graph.edges).design : null),
    [point],
  );

  // Apply the selected design's sizing levers to the matching blocks on the canvas.
  const applyToFlowsheet = () => {
    if (!point) return;
    const { nodes, updateNodeData, updateEdgeData, edges } = useFlowsheetStore.getState();
    let touched = 0;
    const srt = Math.round(point.vars.srtDays);
    const mlss = Math.round(point.vars.mlssMgL);
    const fxt = Number(point.vars.anoxicFraction.toFixed(2));
    // Carry the optimal drivers to every process block that has them (all blocks
    // except the influent + effluent boundaries). Volumes/areas re-derive on the
    // re-run from these drivers, so the whole plant resizes to the chosen design.
    for (const n of nodes) {
      const t = n.data.unitType;
      if (t === 'influent' || t === 'effluent') continue;
      const p = n.data.parameters as Record<string, number>;
      if (t === 'bioreactor_aerobic') {
        updateNodeData(n.id, { parameters: { ...p, srt, mlss } });
        touched++;
      } else if (t === 'bioreactor_anoxic') {
        updateNodeData(n.id, { parameters: { ...p, anoxic_fraction: fxt, srt } });
        touched++;
      } else if (t === 'bioreactor_anaerobic') {
        updateNodeData(n.id, { parameters: { ...p, srt } });
        touched++;
      }
    }
    // Set the IMLR recycle ratio on any recycle line back into a reactor.
    for (const e of edges) {
      const ratio = (e.data as { recycleRatio?: number } | undefined)?.recycleRatio;
      if (ratio !== undefined) updateEdgeData(e.id, { recycleRatio: Number(point.vars.aRecycle.toFixed(1)) });
    }
    setOpen(false);
    // Record the chosen design as the authoritative applied design (drivers above keep the
    // canvas params honest; this guarantees the Design Summary shows exactly this point's
    // numbers, instead of relying on the re-run to re-derive an identical design). This also
    // re-runs the simulation.
    if (design) {
      useSimulationStore.getState().applyOptimizedDesign({
        design,
        objectives: {
          capexZar: point.objectives.capexZar,
          opexZarPerYear: point.objectives.opexZarPerYear,
          footprintM2: point.objectives.footprintM2,
          effluentQualityIndex: point.objectives.effluentQualityIndex,
        },
        trainLabel: trainLabel(point),
      });
    } else {
      useSimulationStore.getState().runSimulation();
    }
    toast.success(`Applied ${trainLabel(point)} design to ${touched} block${touched === 1 ? '' : 's'} — see the Design Summary.`);
  };

  const num = (n: number, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : '—');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Optimise topology + sizing (Pareto front)">
        <Sparkles className="h-3.5 w-3.5 md:mr-1" />
        <span className="hidden md:inline">Optimise</span>
      </Button>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Plant optimiser — Pareto front</DialogTitle>
          <DialogDescription>
            NSGA-II searches topology (AS / MLE / MBR) and sizing (SRT, MLSS, anoxic fraction,
            recycle) for the non-dominated trade-offs between CAPEX, OPEX, footprint and effluent
            quality, subject to your target standards. Pick a design and apply it to the flowsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={running} size="sm">
            {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {running ? 'Searching…' : 'Run optimisation'}
          </Button>
          {result && (
            <span className="text-xs text-muted-foreground">
              {result.paretoFront.length} non-dominated · {result.evaluations} evals · {result.feasibleCount} feasible
            </span>
          )}
        </div>

        {result && result.paretoFront.length > 0 && (
          <ParetoChart points={result.paretoFront} selected={selected} onSelect={setSelected} />
        )}

        {result && result.paretoFront.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {/* Pareto table */}
            <div className="md:col-span-3 max-h-[55vh] overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs">Train</TableHead>
                    <TableHead className="text-right text-xs">CAPEX</TableHead>
                    <TableHead className="text-right text-xs">OPEX/yr</TableHead>
                    <TableHead className="text-right text-xs">Footprint</TableHead>
                    <TableHead className="text-right text-xs">Effl.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.paretoFront.map((p, i) => (
                    <TableRow
                      key={i}
                      onClick={() => setSelected(i)}
                      className={`cursor-pointer ${selected === i ? 'bg-primary/10' : ''}`}
                    >
                      <TableCell className="py-1.5">
                        <Badge variant={selected === i ? 'default' : 'outline'} className="text-[10px]">{trainLabel(p)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(p.objectives.capexZar)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(p.objectives.opexZarPerYear)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Math.round(p.objectives.footprintM2)} m²</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Math.round(p.objectives.effluentQualityIndex)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Selected-design detail */}
            <div className="md:col-span-2 rounded-md border border-border p-3 overflow-y-auto max-h-[55vh]">
              {point && design ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="text-[10px]">{trainLabel(point)}</Badge>
                    <Button size="xs" onClick={applyToFlowsheet}>
                      Apply to flowsheet <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>

                  <DetailGroup title="Sizing" rows={[
                    ['Total reactor', `${num(design.reactor.volumeSelectedM3)} m³`],
                    ['Aerobic volume', `${num(design.reactor.aerobicVolumeM3)} m³`],
                    ...(design.reactor.anoxicVolumeM3 > 0 ? [['Anoxic volume', `${num(design.reactor.anoxicVolumeM3)} m³`] as [string, string]] : []),
                    ['Total HRT', `${num(design.reactor.hrtTotalH)} h`],
                    ['SRT', `${num(design.process.sludgeAgeDays, 0)} d`],
                    ['MLSS', `${num(design.process.mlssMgL, 0)} mg/L`],
                    ...(design.mbr.included ? [['Membrane area', `${num(design.mbr.membraneAreaM2, 0)} m²`] as [string, string], ['SMU modules', `${design.mbr.moduleCount}`] as [string, string]] : []),
                  ]} />

                  <DetailGroup title="Flows & recycle" rows={[
                    ['ADWF', `${num(design.flows.adwf, 0)} m³/d`],
                    ['AWWF', `${num(design.flows.awwf, 0)} m³/d`],
                    ['PDWF', `${num(design.flows.pdwf, 0)} m³/d`],
                    ['a-recycle (IMLR)', `${num(design.process.recycle.a, 1)}×`],
                    ['r-recycle (RAS)', `${num(design.process.recycle.r, 1)}×`],
                  ]} />

                  <DetailGroup title="Aeration" rows={[
                    ['Total O₂ demand', `${num(design.aeration.o2TotalKgD)} kgO/d`],
                    ['Process air', `${num(design.aeration.processAirAm3h, 0)} Am³/h`],
                    ['Blower power', `${num(design.aeration.blowerKW)} kW`],
                  ]} />

                  <DetailGroup title="Effluent" rows={[
                    ['NH₃-N', `${num(design.effluent.ammoniaMgL, 2)} mg/L`],
                    ['NO₃-N', `${num(design.effluent.nitrateMgL, 2)} mg/L`],
                    ['TKN', `${num(design.effluent.tknMgL, 2)} mg/L`],
                    ['N removal', `${num(design.effluent.nitrogenRemovalPct, 0)} %`],
                  ]} />

                  <DetailGroup title="Economics" rows={[
                    ['CAPEX', money(point.objectives.capexZar)],
                    ['OPEX/yr', money(point.objectives.opexZarPerYear)],
                    ['Footprint', `${Math.round(point.objectives.footprintM2)} m²`],
                  ]} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Select a design from the table to see its full sizing and flows.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ParetoTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { train: string; x: number; y: number; effl: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md">
      <div className="font-medium">{d.train}</div>
      <div className="text-muted-foreground">R {d.x}M · {d.y} m² · effl {d.effl}</div>
    </div>
  );
}

function ParetoChart({ points, selected, onSelect }: { points: ParetoPoint[]; selected: number | null; onSelect: (i: number) => void }) {
  // Sort by CAPEX so the connecting line traces the cost↔footprint trade-off front.
  const data = points
    .map((p, i) => ({
      x: Math.round(p.objectives.capexZar / 1e4) / 100, // R M, 2dp
      y: Math.round(p.objectives.footprintM2),
      effl: Math.round(p.objectives.effluentQualityIndex),
      train: `${p.vars.nitrogenRemoval ? 'MLE' : 'AS'}${p.vars.mbr ? '+MBR' : '+SC'}`,
      idx: i,
    }))
    .sort((a, b) => a.x - b.x);

  // Auto-scale axes to the data (with padding) so the points spread across the plot
  // instead of clustering in a corner of a fixed 0..2M / 0..36 axis.
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const pad = (lo: number, hi: number) => (hi > lo ? (hi - lo) * 0.12 : Math.max(hi * 0.1, 1));
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yLo = Math.min(...ys), yHi = Math.max(...ys);
  const xDomain: [number, number] = [Math.max(0, xLo - pad(xLo, xHi)), xHi + pad(xLo, xHi)];
  const yDomain: [number, number] = [Math.max(0, yLo - pad(yLo, yHi)), yHi + pad(yLo, yHi)];

  return (
    <div className="rounded-md border border-border p-2">
      <ResponsiveContainer width="100%" height={230}>
        <ScatterChart margin={{ top: 10, right: 18, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
          <XAxis type="number" dataKey="x" name="CAPEX" unit="M" domain={xDomain} tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v}`}
            label={{ value: 'CAPEX (R M) →', position: 'insideBottom', offset: -12, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Footprint" unit="" domain={yDomain} width={52} tick={{ fontSize: 11 }}
            label={{ value: 'Footprint m²', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ParetoTooltip />} />
          <Scatter
            data={data}
            line={{ stroke: '#16a34a', strokeWidth: 1, strokeDasharray: '5 3' }}
            lineType="joint"
            shape="circle"
            isAnimationActive={false}
            onClick={(d: unknown) => {
              const i = (d as { idx?: number; payload?: { idx?: number } }).idx ?? (d as { payload?: { idx?: number } }).payload?.idx;
              if (typeof i === 'number') onSelect(i);
            }}
          >
            {data.map((d) => (
              <Cell key={d.idx} fill={d.idx === selected ? '#16a34a' : '#94a3b8'} r={d.idx === selected ? 7 : 5} cursor="pointer" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-center text-[10px] text-muted-foreground">
        {points.length} non-dominated design{points.length === 1 ? '' : 's'} — 2-D view (CAPEX vs footprint) of the
        4-objective front. Click a point to inspect &amp; apply; down-left = cheaper + smaller.
      </p>
    </div>
  );
}

function DetailGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <dl className="mt-0.5 space-y-0.5 font-mono text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
