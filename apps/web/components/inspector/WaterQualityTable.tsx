'use client';

import type { WaterQuality } from '@repo/sim-engine';

const WQ_PARAMS: { key: keyof WaterQuality; label: string; unit: string }[] = [
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

export function WaterQualityTable({ wq }: { wq: WaterQuality }) {
  return (
    <div className="space-y-0.5 font-mono">
      {WQ_PARAMS.map(({ key, label, unit }) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {label}
            {unit && <span className="text-muted-foreground/60 ml-1">({unit})</span>}
          </span>
          <span className="text-foreground">
            {typeof wq[key] === 'number' ? (wq[key] as number).toFixed(2) : wq[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
