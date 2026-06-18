/**
 * Electrical load-list projection (T7.2) — a read-only EXAMPLE of the consumer
 * pattern: it sums params.installedKW per object and maps power connections to
 * a feeder, recomputing NOTHING. Demonstrates that a future electrical module is
 * a pure consumer of the DesignPackage objects[].
 */
import type { DesignPackage, EngineeringObject } from '@repo/object-model';

export interface LoadListRow {
  tag: string;
  label: string;
  installedKW: number;
  vfd: boolean;
  /** Object id of the MCC/feeder this load connects to (medium='power'), if any. */
  feederFrom: string | null;
}

export interface LoadList {
  rows: LoadListRow[];
  totalKW: number;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

function installedKWof(o: EngineeringObject): number | undefined {
  const p = o.params;
  if ((p.kind === 'blower' || p.kind === 'pump') && p.installedKW) return p.installedKW.value;
  if ((p.kind === 'equipment' || p.kind === 'screen') && p.installedKW) return p.installedKW.value;
  return undefined;
}

export function loadList(pkg: DesignPackage): LoadList {
  const rows: LoadListRow[] = [];
  for (const o of pkg.objects) {
    const kw = installedKWof(o);
    if (kw === undefined) continue;
    const p = o.params;
    const vfd = (p.kind === 'blower' || p.kind === 'pump') && p.vfd === true;
    const power = o.connections.find((c) => c.medium === 'power');
    rows.push({ tag: o.tag, label: o.label, installedKW: kw, vfd, feederFrom: power?.toObjectId ?? null });
  }
  return { rows, totalKW: round2(rows.reduce((s, r) => s + r.installedKW, 0)) };
}
