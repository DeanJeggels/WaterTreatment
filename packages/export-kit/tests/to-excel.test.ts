import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { defaultInputs, runAutoDesign, assembleDesignPackage } from '@repo/auto-design';
import { toExcel, EXCEL_SHEET_NAMES } from '../src/to-excel';

function pkg() {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  inp.designFlowM3d = 10000;
  inp.siteAreaM2 = 40000;
  return assembleDesignPackage(runAutoDesign(inp, { flowsheetId: 'fs-1' }), {
    projectId: 'p-1',
    flowsheetId: 'fs-1',
    generatedAt: '2026-06-18T09:00:00Z',
  });
}

describe('toExcel (T6.5)', () => {
  it('produces a workbook with the named sheets', () => {
    const wb = XLSX.read(toExcel(pkg()), { type: 'array' });
    for (const name of EXCEL_SHEET_NAMES) expect(wb.SheetNames).toContain(name);
  });

  it('BoQ sheet row count == Σ line items (+ header + grand total)', () => {
    const p = pkg();
    const expectedItems = Object.values(p.boq.lineItemsByCategory).reduce((s, items) => s + items.length, 0);
    const wb = XLSX.read(toExcel(p), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['BoQ']!, { header: 1 }) as unknown[][];
    expect(rows.length).toBe(expectedItems + 2); // header + items + grand total
  });

  it('Calculation Trail carries the provenance records', () => {
    const p = pkg();
    const wb = XLSX.read(toExcel(p), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Calculation Trail']!, { header: 1 }) as unknown[][];
    expect(rows.length).toBe(p.provenance.calculations.length + 1); // + header
  });

  it('is deterministic in content for a fixed package', () => {
    const a = XLSX.read(toExcel(pkg()), { type: 'array' });
    const b = XLSX.read(toExcel(pkg()), { type: 'array' });
    const dump = (wb: XLSX.WorkBook) =>
      wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n]!)).join('\n---\n');
    expect(dump(a)).toBe(dump(b));
  });
});
