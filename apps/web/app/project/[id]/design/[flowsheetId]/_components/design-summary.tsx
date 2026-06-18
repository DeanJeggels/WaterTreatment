'use client';

import type { DesignPackage, EngineeringObject } from '@repo/object-model';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

/**
 * DesignSummary (T6.3) — sized-unit table + compliance verdict + totals. Reads
 * the persisted DesignPackage VERBATIM; computes nothing engineering.
 */
export function DesignSummary({ pkg }: { pkg: DesignPackage }) {
  return (
    <div className="space-y-6">
      <Totals pkg={pkg} />
      <Compliance pkg={pkg} />
      <UnitTable objects={pkg.objects} />
    </div>
  );
}

function dimsOf(o: EngineeringObject): string {
  const g = o.geometry;
  if (g.shape === 'circle' && g.diameterM) {
    return `Ø${g.diameterM.value} m${g.heightM ? ` × ${g.heightM.value} m SWD` : ''}`;
  }
  return `${g.footprint.lengthM} × ${g.footprint.widthM} m${g.heightM ? ` × ${g.heightM.value} m` : ''}`;
}

function capacityOf(o: EngineeringObject): string {
  const keys = ['volume', 'surfaceArea', 'airFlow', 'tankVolume'];
  const parts: string[] = [];
  for (const k of keys) {
    const d = o.capacity[k];
    if (d) parts.push(`${d.value} ${d.unit}`);
  }
  return parts.join(' · ') || '—';
}

function UnitTable({ objects }: { objects: EngineeringObject[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Sized units ({objects.length})</h2>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Dimensions</TableHead>
              <TableHead>Capacity / duty</TableHead>
              <TableHead>Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {objects.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.tag}</TableCell>
                <TableCell>{o.label}</TableCell>
                <TableCell className="text-xs">{dimsOf(o)}</TableCell>
                <TableCell className="text-xs">{capacityOf(o)}</TableCell>
                <TableCell className="text-xs">{o.material.primary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Compliance({ pkg }: { pkg: DesignPackage }) {
  const entries = Object.entries(pkg.compliance.perParameter);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Compliance — {pkg.compliance.standard}</h2>
        <Badge variant={pkg.compliance.pass ? 'default' : 'destructive'}>
          {pkg.compliance.pass ? 'PASS' : 'REVIEW'}
        </Badge>
      </div>
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Predicted</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([param, v]) => (
                <TableRow key={param}>
                  <TableCell>{param}</TableCell>
                  <TableCell>{v.predicted}</TableCell>
                  <TableCell>{v.target}</TableCell>
                  <TableCell>
                    <span className={v.pass ? 'text-green-600' : 'text-destructive'}>{v.pass ? '✓' : '✗'}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Totals({ pkg }: { pkg: DesignPackage }) {
  const zar = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;
  const cards = [
    { label: 'Capex (preliminary)', value: zar(pkg.totals.capexZar) },
    { label: 'Installed power', value: `${pkg.totals.installedKW} kW` },
    { label: 'Footprint', value: `${Math.round(pkg.totals.footprintM2).toLocaleString('en-ZA')} m²` },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-border p-4">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
