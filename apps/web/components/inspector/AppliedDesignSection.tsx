'use client';

import type { AppliedDesign } from '@/stores/simulation-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { InspectorSection } from './InspectorSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';

function money(zar: number): string {
  if (!Number.isFinite(zar)) return '—';
  if (zar >= 1e6) return `R ${(zar / 1e6).toFixed(2)}M`;
  if (zar >= 1e3) return `R ${(zar / 1e3).toFixed(0)}k`;
  return `R ${zar.toFixed(0)}`;
}
const n = (v: number, dp = 1) => (Number.isFinite(v) ? v.toFixed(dp) : '—');

/**
 * The optimiser design the engineer explicitly applied to the flowsheet. Shows the
 * EXACT numbers from the chosen Pareto point (same as the optimiser detail panel),
 * so "Optimise → pick a point → Apply" is always reflected here regardless of which
 * canvas element is selected. Sourced from the authoritative applied design in the
 * store, not a re-derivation.
 */
export function AppliedDesignSection({ appliedDesign }: { appliedDesign: AppliedDesign | null }) {
  const clear = useSimulationStore((s) => s.clearAppliedDesign);
  if (!appliedDesign) return null;

  const { design, objectives, trainLabel } = appliedDesign;
  const rows: Array<[string, string]> = [
    ['Footprint', `${Math.round(objectives.footprintM2)} m²`],
    ['CAPEX', money(objectives.capexZar)],
    ['OPEX/yr', money(objectives.opexZarPerYear)],
    ['Total reactor', `${n(design.reactor.volumeSelectedM3)} m³`],
    ['Aerobic volume', `${n(design.reactor.aerobicVolumeM3)} m³`],
    ...(design.reactor.anoxicVolumeM3 > 0
      ? ([['Anoxic volume', `${n(design.reactor.anoxicVolumeM3)} m³`]] as Array<[string, string]>)
      : []),
    ...(design.reactor.anaerobicVolumeM3 > 0
      ? ([['Anaerobic volume', `${n(design.reactor.anaerobicVolumeM3)} m³`]] as Array<[string, string]>)
      : []),
    ['Total HRT', `${n(design.reactor.hrtTotalH)} h`],
    ['SRT', `${n(design.process.sludgeAgeDays, 0)} d`],
    ['MLSS', `${n(design.process.mlssMgL, 0)} mg/L`],
    ...(design.mbr.included
      ? ([
          ['Membrane area', `${n(design.mbr.membraneAreaM2, 0)} m²`],
          ['SMU modules', `${design.mbr.moduleCount}`],
        ] as Array<[string, string]>)
      : []),
    ['Effluent NH₃-N', `${n(design.effluent.ammoniaMgL, 2)} mg/L`],
    ['Effluent NO₃-N', `${n(design.effluent.nitrateMgL, 2)} mg/L`],
    ['N removal', `${n(design.effluent.nitrogenRemovalPct, 0)} %`],
  ];

  return (
    <InspectorSection title="Applied optimal design" className="rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <Badge className="gap-1 text-[10px]">
          <Sparkles className="h-3 w-3" />
          {trainLabel}
        </Badge>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={clear}
          title="Clear applied design (revert to live sizing)"
          aria-label="Clear applied design"
          className="text-muted-foreground hover:text-destructive"
        >
          <X />
        </Button>
      </div>
      <dl className="space-y-1 font-mono text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </InspectorSection>
  );
}
