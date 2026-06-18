/**
 * Excel exporter (T6.5) — a lossy projection of the SAME persisted package the
 * JSON/PDF read. Sheets: Design Summary · Sizing · Equipment Schedule · BoQ ·
 * Energy · Calculation Trail. Pure: returns a workbook byte array, reading the
 * package verbatim (no engineering computation).
 */
import * as XLSX from 'xlsx';
import type { DesignPackage, EngineeringObject } from '@repo/object-model';

interface BoqItemLike {
  category?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPriceZar?: number;
  totalPriceZar?: number;
  sourceCitation?: string;
}

type Row = (string | number)[];

function objInstalledKW(o: EngineeringObject): number | undefined {
  const p = o.params;
  if ((p.kind === 'blower' || p.kind === 'pump') && p.installedKW) return p.installedKW.value;
  if ((p.kind === 'equipment' || p.kind === 'screen') && p.installedKW) return p.installedKW.value;
  return undefined;
}

function dutyOf(o: EngineeringObject): string {
  const p = o.params;
  switch (p.kind) {
    case 'tank':
      return `${p.function} · ${p.volumeM3.value} ${p.volumeM3.unit}`;
    case 'blower':
      return `${p.airFlowAm3H.value} ${p.airFlowAm3H.unit} @ ${p.dischargePressureKpa.value} kPa · ${p.installedKW.value} kW · ${p.configuration}`;
    case 'pump':
      return `${p.dutyFlowM3H.value} ${p.dutyFlowM3H.unit} @ ${p.headM.value} m · ${p.installedKW.value} kW`;
    case 'dosing_skid':
      return `${p.chemical} · ${p.doseMgL.value} mg/L`;
    case 'screen':
      return `${p.screenType} · ${p.apertureMm.value} mm`;
    default:
      return p.equipmentType ?? '';
  }
}

export function toExcel(pkg: DesignPackage): Uint8Array {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Row[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);

  // Design Summary
  add('Design Summary', [
    ['Project', pkg.meta.projectName],
    ['Plant type', pkg.meta.plantType],
    ['Discharge standard', pkg.compliance.standard],
    ['Compliance', pkg.compliance.pass ? 'PASS' : 'REVIEW'],
    ['Capex (ZAR)', pkg.totals.capexZar],
    ['Installed power (kW)', pkg.totals.installedKW],
    ['Footprint (m2)', pkg.totals.footprintM2],
    ['Generated at', pkg.meta.generatedAt],
    ['Schema version', pkg.schemaVersion],
  ]);

  // Sizing — one row per object
  const sizingRows: Row[] = [['Tag', 'Unit', 'Class', 'Shape', 'Length m', 'Width m', 'Diameter m', 'Height m']];
  for (const o of pkg.objects) {
    sizingRows.push([
      o.tag,
      o.label,
      o.class,
      o.geometry.shape,
      o.geometry.footprint.lengthM,
      o.geometry.footprint.widthM,
      o.geometry.diameterM?.value ?? '',
      o.geometry.heightM?.value ?? '',
    ]);
  }
  add('Sizing', sizingRows);

  // Equipment Schedule
  const equipRows: Row[] = [['Tag', 'Label', 'Class', 'Discipline', 'Material', 'Duty']];
  for (const o of pkg.objects) {
    equipRows.push([o.tag, o.label, o.class, o.discipline, o.material.primary, dutyOf(o)]);
  }
  add('Equipment Schedule', equipRows);

  // BoQ — iterate lineItemsByCategory verbatim
  const boqRows: Row[] = [['Category', 'Description', 'Quantity', 'Unit', 'Rate ZAR', 'Total ZAR', 'Citation']];
  for (const [category, items] of Object.entries(pkg.boq.lineItemsByCategory)) {
    for (const raw of items as BoqItemLike[]) {
      boqRows.push([
        category,
        raw.description ?? '',
        raw.quantity ?? '',
        raw.unit ?? '',
        raw.unitPriceZar ?? '',
        raw.totalPriceZar ?? '',
        raw.sourceCitation ?? '',
      ]);
    }
  }
  boqRows.push(['', 'GRAND TOTAL', '', '', '', pkg.boq.grandTotalZar, '']);
  add('BoQ', boqRows);

  // Energy
  const energyRows: Row[] = [['Tag', 'Unit', 'Installed kW']];
  for (const o of pkg.objects) {
    const kw = objInstalledKW(o);
    if (kw !== undefined) energyRows.push([o.tag, o.label, kw]);
  }
  energyRows.push(['', 'TOTAL', pkg.totals.installedKW]);
  add('Energy', energyRows);

  // Calculation Trail — flatten provenance
  const calcRows: Row[] = [['Label', 'Symbol', 'Equation', 'Result', 'Unit', 'Citation']];
  for (const r of pkg.provenance.calculations) {
    calcRows.push([r.label, r.symbol, r.equation, r.result.value, r.result.unit, r.citation]);
  }
  add('Calculation Trail', calcRows);

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** Sheet names this exporter always produces (stable order). */
export const EXCEL_SHEET_NAMES = [
  'Design Summary',
  'Sizing',
  'Equipment Schedule',
  'BoQ',
  'Energy',
  'Calculation Trail',
] as const;
