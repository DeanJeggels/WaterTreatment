import type { AggregatedBoQ, BoQCategory } from '@repo/sim-engine';
import { BOQ_CATEGORIES } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  boq: AggregatedBoQ | null;
}

const CATEGORY_LABEL: Record<BoQCategory, string> = {
  civil: 'Civil Works',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  chemicals: 'Chemicals & Consumables',
  instrumentation: 'Instrumentation',
};

function fmtZAR(n: number): string {
  return n.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

export function BillOfQuantitiesSection({ boq }: Props) {
  if (!boq || boq.grandTotal === 0) {
    return (
      <SectionShell number={9} title="Bill of Quantities">
        <p className="text-muted-foreground italic">Run the simulation to populate the Bill of Quantities.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={9} title="Bill of Quantities">
      {BOQ_CATEGORIES.map((category) => {
        const items = boq.lineItemsByCategory[category];
        if (items.length === 0) return null;
        const subtotal = boq.subtotalsByCategory[category];
        return (
          <div key={category} className="print:break-inside-avoid mb-4">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORY_LABEL[category] ?? category}
            </h3>
            <table className="w-full text-sm border-collapse">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="pb-1.5 w-[45%]">Description</th>
                  <th className="pb-1.5 text-right">Qty</th>
                  <th className="pb-1.5 text-right">Unit price (ZAR)</th>
                  <th className="pb-1.5 text-right">Total (ZAR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border/40 align-top">
                    <td className="py-1.5">
                      <div className="text-foreground">{item.description}</div>
                      <div className="text-[11px] text-muted-foreground italic">{item.sourceCitation}</div>
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {item.quantity.toFixed(item.quantity >= 10 ? 0 : 1)} {item.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtZAR(item.unitPriceZar)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtZAR(item.quantity * item.unitPriceZar)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={3} className="py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="py-2 text-right font-mono text-foreground">R{fmtZAR(subtotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      <div className="mt-6 rounded-md border-2 border-border bg-muted/20 px-4 py-3 flex items-baseline justify-between print:break-inside-avoid">
        <span className="text-base font-semibold text-foreground">Grand total CapEx</span>
        <span className="font-mono text-lg font-semibold text-foreground">R{fmtZAR(boq.grandTotal)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground italic mt-1">
        Prices are indicative. Obtain formal supplier quotes before procurement.
      </p>
    </SectionShell>
  );
}
