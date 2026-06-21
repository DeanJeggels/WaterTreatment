'use client';

import type { PlantEvaluation } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { Badge } from '@/components/ui/badge';

interface Props {
  evaluation: PlantEvaluation | null;
}

interface Row {
  label: string;
  value: string;
}

export function DelegateSection({ evaluation }: Props) {
  if (!evaluation) return null;
  const { recognisedTrain: train, delegatedDesign: design } = evaluation;

  if (!train.matched || !design) {
    return (
      <InspectorSection title="Validated design (delegate)" description="MLE / MLE-MBR recognition">
        <p className="text-[11px] text-muted-foreground">
          Not a recognised MLE/MBR train, so the exact WWTP Design.xlsm sizing is not applied.
          {train.reason ? ` (${train.reason})` : ''}
        </p>
      </InspectorSection>
    );
  }

  const num = (n: number, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : '—');
  const rows: Row[] = [
    { label: 'Total reactor', value: `${num(design.reactor.volumeSelectedM3)} m³` },
    { label: 'Aerobic volume', value: `${num(design.reactor.aerobicVolumeM3)} m³` },
    ...(design.reactor.anoxicVolumeM3 > 0 ? [{ label: 'Anoxic volume', value: `${num(design.reactor.anoxicVolumeM3)} m³` }] : []),
    { label: 'Sludge age (SRT)', value: `${num(design.process.sludgeAgeDays, 0)} d` },
    { label: 'MLSS', value: `${num(design.process.mlssMgL, 0)} mg/L` },
    { label: 'Effluent NH₃-N', value: `${num(design.effluent.ammoniaMgL, 2)} mg/L` },
    { label: 'Effluent NO₃-N', value: `${num(design.effluent.nitrateMgL, 2)} mg/L` },
    { label: 'N removal', value: `${num(design.effluent.nitrogenRemovalPct, 0)} %` },
    { label: 'Process air', value: `${num(design.aeration.processAirAm3h, 0)} Am³/h` },
    ...(design.mbr.included
      ? [
          { label: 'Membrane area', value: `${num(design.mbr.membraneAreaM2, 0)} m²` },
          { label: 'SMU modules', value: `${design.mbr.moduleCount}` },
        ]
      : []),
  ];

  return (
    <InspectorSection
      title="Validated design (delegate)"
      description="Exact WWTP Design.xlsm / Marais-Ekama sizing"
    >
      <div className="flex items-center gap-2">
        <Badge className="text-[10px]">{train.config?.replace('_', '-')}</Badge>
        <span className="text-[11px] text-muted-foreground">recognised train</span>
      </div>
      <dl className="mt-1 space-y-0.5 font-mono text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        These are the coupled whole-reactor numbers (correct under recycle), not the per-block
        estimate. {design.warnings[0] ? design.warnings[0] : ''}
      </p>
    </InspectorSection>
  );
}
