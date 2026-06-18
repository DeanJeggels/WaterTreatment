'use client';

import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { toJSON, toExcel } from '@repo/export-kit';
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
import { Button } from '@/components/ui/button';

/**
 * DesignSummary (T6.3) — sized-unit table + compliance verdict + totals, plus
 * JSON/Excel/PDF exports (T6.2/T6.4/T6.6). Reads the persisted DesignPackage
 * VERBATIM; computes nothing engineering. Exports are projections of the SAME
 * package, so they can never disagree.
 */
export function DesignSummary({ pkg }: { pkg: DesignPackage }) {
  return (
    <div className="space-y-6">
      <ExportBar pkg={pkg} />
      <Totals pkg={pkg} />
      <Compliance pkg={pkg} />
      <UnitTable objects={pkg.objects} />
      <CalculationTrail pkg={pkg} />
    </div>
  );
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportBar({ pkg }: { pkg: DesignPackage }) {
  const base = `${pkg.meta.projectName || 'design'}-${pkg.meta.plantType}`.replace(/\s+/g, '_');
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {/* T6.2 — JSON: the canonical, persisted package */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => download(`${base}.json`, new Blob([toJSON(pkg)], { type: 'application/json' }))}
      >
        <Download className="mr-1.5 h-4 w-4" /> JSON
      </Button>
      {/* T6.6 — Excel */}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          download(
            `${base}.xlsx`,
            new Blob([toExcel(pkg) as BlobPart], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
          )
        }
      >
        <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
      </Button>
      {/* T6.4 — PDF via the browser print path (no server-side dep) */}
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-1.5 h-4 w-4" /> PDF
      </Button>
    </div>
  );
}

function CalculationTrail({ pkg }: { pkg: DesignPackage }) {
  const records = pkg.provenance.calculations;
  if (records.length === 0) return null;
  return (
    <details className="rounded-md border border-border p-4 print:open" open={false}>
      <summary className="cursor-pointer text-sm font-semibold">Calculation trail ({records.length} records)</summary>
      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quantity</TableHead>
              <TableHead>Equation</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Citation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{r.label}</TableCell>
                <TableCell className="font-mono text-xs">{r.equation}</TableCell>
                <TableCell className="text-xs">
                  {r.result.value} {r.result.unit}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.citation}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
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
